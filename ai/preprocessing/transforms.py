"""MONAI preprocessing transforms aligned with notebook training."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np
import torch
from configs.experiment_config import ExperimentConfig
from monai.inferers import sliding_window_inference
from monai.transforms import (
    AsDiscreted,
    Compose,
    EnsureChannelFirstd,
    EnsureTyped,
    LoadImaged,
    NormalizeIntensityd,
    Orientationd,
    RandFlipd,
    RandRotated,
    ResizeWithPadOrCropd,
    ScaleIntensityRanged,
    Spacingd,
    SpatialPadd,
)


def _intensity_transform(config: ExperimentConfig):
    if config.normalize_mode == "zscore":
        return NormalizeIntensityd(keys=["image"], nonzero=True, channel_wise=True)
    return ScaleIntensityRanged(
        keys=["image"],
        a_min=config.intensity_range[0],
        a_max=config.intensity_range[1],
        b_min=0.0,
        b_max=1.0,
        clip=True,
    )


def get_spatial_preprocessing(
    config: ExperimentConfig,
    keys: Sequence[str] = ("image", "label"),
    track_meta: bool = True,
) -> Compose:
    key_list = list(keys)
    transforms = [
        LoadImaged(keys=key_list, image_only=False),
        EnsureChannelFirstd(keys=key_list),
    ]
    if config.apply_spacing:
        transforms.append(
            Spacingd(
                keys=key_list,
                pixdim=config.target_spacing,
                mode=("bilinear", "nearest") if "label" in key_list else "bilinear",
            )
        )
    transforms.extend(
        [
            Orientationd(keys=key_list, axcodes=config.orientation),
            _intensity_transform(config),
        ]
    )
    if "label" in key_list:
        transforms.append(AsDiscreted(keys=["label"]))
    transforms.extend(
        [
            SpatialPadd(
                keys=key_list,
                spatial_size=config.roi_size,
                mode="constant",
                method="symmetric",
            ),
            ResizeWithPadOrCropd(
                keys=key_list,
                spatial_size=config.roi_size,
                mode="constant",
            ),
            EnsureTyped(keys=key_list, track_meta=track_meta),
        ]
    )
    return Compose(transforms)


def get_deterministic_transforms(
    config: ExperimentConfig,
    keys: Sequence[str] = ("image", "label"),
) -> Compose:
    return get_spatial_preprocessing(config, keys=keys, track_meta=False)


def get_train_augmentations(config: ExperimentConfig) -> Compose:
    return Compose(
        [
            RandFlipd(keys=["image", "label"], spatial_axis=0, prob=0.5),
            RandFlipd(keys=["image", "label"], spatial_axis=1, prob=0.5),
            RandFlipd(keys=["image", "label"], spatial_axis=2, prob=0.5),
            RandRotated(
                keys=["image", "label"],
                range_x=0.26,
                range_y=0.26,
                range_z=0.26,
                prob=0.5,
                mode=("bilinear", "nearest"),
                padding_mode="border",
            ),
            EnsureTyped(keys=["image", "label"], track_meta=False),
        ]
    )


def get_val_transforms(config: ExperimentConfig) -> Compose:
    return get_spatial_preprocessing(config, keys=("image", "label"), track_meta=True)


def get_test_transforms(config: ExperimentConfig) -> Compose:
    return get_spatial_preprocessing(config, keys=("image",), track_meta=True)


def get_in_memory_test_transforms(config: ExperimentConfig) -> Compose:
    """Test-time transforms for numpy arrays already loaded from NIfTI."""
    return Compose(
        [
            EnsureChannelFirstd(keys=["image"], channel_dim="no_channel"),
            _intensity_transform(config),
            SpatialPadd(
                keys=["image"],
                spatial_size=config.roi_size,
                mode="constant",
                method="symmetric",
            ),
            ResizeWithPadOrCropd(
                keys=["image"],
                spatial_size=config.roi_size,
                mode="constant",
            ),
            EnsureTyped(keys=["image"], track_meta=False),
        ]
    )


def preprocess_image_array(image: np.ndarray, config: ExperimentConfig) -> np.ndarray:
    """Apply test-time transforms to an in-memory image array (no label)."""
    sample = {"image": image.astype(np.float32)}
    transformed = get_in_memory_test_transforms(config)(sample)
    output = transformed["image"]
    if isinstance(output, torch.Tensor):
        output = output.detach().cpu().numpy()
    if output.ndim == 3:
        output = output[np.newaxis, ...]
    return output.astype(np.float32)


def predict_volume(model: torch.nn.Module, images: torch.Tensor, config: ExperimentConfig) -> torch.Tensor:
    model.eval()
    spatial = images.shape[2:]
    if any(s > r for s, r in zip(spatial, config.roi_size)):
        return sliding_window_inference(
            inputs=images,
            roi_size=config.roi_size,
            sw_batch_size=config.sw_batch_size,
            predictor=model,
            overlap=config.sw_overlap,
            mode="gaussian",
        )
    return model(images)


def predict_volume_numpy(
    model: torch.nn.Module,
    image: np.ndarray,
    config: ExperimentConfig,
    device: torch.device,
) -> np.ndarray:
    tensor = torch.from_numpy(image).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = predict_volume(model, tensor, config)
    return torch.argmax(torch.softmax(logits, dim=1), dim=1).squeeze(0).cpu().numpy().astype(np.uint8)
