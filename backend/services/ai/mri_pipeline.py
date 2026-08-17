"""Hippocampus MRI inference via integrated ai/ Hybrid Attention U-Net."""

from __future__ import annotations

import logging
import sys
import uuid
from pathlib import Path
from typing import Any

import nibabel as nib
import numpy as np
import torch

from services.ai.mesh import generate_mesh_exports

_log = logging.getLogger(__name__)

_orm_modules_snapshot: dict[str, Any] | None = None


class NiftiInputError(ValueError):
    """Invalid or unreadable NIfTI input."""


def _snapshot_orm_modules() -> dict[str, Any]:
    """Capture current ORM ``models.*`` entries from *sys.modules*."""
    return {
        key: sys.modules[key]
        for key in list(sys.modules)
        if key == "models" or key.startswith("models.")
    }


def _save_orm_modules() -> None:
    global _orm_modules_snapshot
    _orm_modules_snapshot = _snapshot_orm_modules()


def _restore_orm_modules() -> None:
    global _orm_modules_snapshot
    if not _orm_modules_snapshot:
        return
    sys.modules.update(_orm_modules_snapshot)
    _orm_modules_snapshot = None


def _ensure_backend_ai_on_path(backend_ai_root: Path) -> None:
    """Prepend integrated ai/ package root to sys.path.

    The backend's ORM ``models`` package is already cached in *sys.modules*
    from startup.  We temporarily evict it so that the AI ``models``
    sub-package (hybrid_attention_unet, etc.) is found at the new path
    position.  Callers should invoke :func:`_restore_orm_modules` after
    the AI imports are done so that the ORM modules are available again.
    """
    _save_orm_modules()

    root = str(backend_ai_root.resolve())
    while root in sys.path:
        sys.path.remove(root)
    sys.path.insert(0, root)

    ai_models_dir = str(Path(root) / "models")
    stale = [
        key
        for key in list(sys.modules)
        if key == "models" or key.startswith("models.")
    ]
    for key in stale:
        mod = sys.modules.get(key)
        mod_path = getattr(mod, "__path__", None)
        if mod_path and any(str(p).rstrip("/\\") == ai_models_dir.rstrip("/\\") for p in mod_path):
            continue
        del sys.modules[key]


def _voxel_volume_mm3_from_spacing(spacing: tuple[float, float, float]) -> float:
    return float(spacing[0] * spacing[1] * spacing[2])


def _spacing_from_nifti(image: nib.Nifti1Image) -> tuple[float, float, float]:
    zooms = image.header.get_zooms()
    if len(zooms) >= 3:
        return (float(zooms[0]), float(zooms[1]), float(zooms[2]))
    return (1.0, 1.0, 1.0)


def _class_volumes_ml(pred: np.ndarray, voxel_volume_mm3: float) -> dict[str, float]:
    left_vox = int((pred == 1).sum())
    right_vox = int((pred == 2).sum())
    fg_vox = int((pred > 0).sum())
    left_ml = left_vox * voxel_volume_mm3 / 1000.0
    right_ml = right_vox * voxel_volume_mm3 / 1000.0
    total_ml = fg_vox * voxel_volume_mm3 / 1000.0
    brain_vox = max(int(pred.size), 1)
    burden = min(1.0, fg_vox / brain_vox) if brain_vox else 0.0
    return {
        "total_hippocampus_ml": total_ml,
        "left_hippocampus_ml": left_ml,
        "right_hippocampus_ml": right_ml,
        "hippocampus_burden": burden,
        "left_burden": left_ml / total_ml if total_ml > 0 else 0.0,
        "right_burden": right_ml / total_ml if total_ml > 0 else 0.0,
    }


def hippocampus_metrics_to_legacy(volumes: dict[str, float]) -> dict[str, float]:
    """Map hippocampus volumes onto legacy ILD-named DB/API fields."""
    total = volumes["total_hippocampus_ml"]
    left = volumes["left_hippocampus_ml"]
    right = volumes["right_hippocampus_ml"]
    burden = volumes["hippocampus_burden"]
    left_b = volumes["left_burden"]
    right_b = volumes["right_burden"]
    return {
        "total_ild_volume_ml": total,
        "lung_volume_ml": total / burden if burden > 0 else total,
        "ggo_volume_ml": left,
        "reticulation_volume_ml": right,
        "consolidation_volume_ml": 0.0,
        "ggo_burden": left_b,
        "reticulation_burden": right_b,
        "consolidation_burden": 0.0,
        "ild_burden": burden,
        **volumes,
    }


def _load_experiment_config(backend_ai_root: Path, architecture_config: dict | None):
    from configs.experiment_config import ExperimentConfig, load_experiment_config

    if architecture_config:
        return ExperimentConfig.from_dict(architecture_config)
    default_path = backend_ai_root / "configs" / "hybrid_attention_v1.json"
    return load_experiment_config(default_path)


def _run_model_on_roi(
    roi_array: np.ndarray,
    *,
    weights_path: Path,
    backend_ai_root: Path,
    architecture_config: dict | None,
) -> np.ndarray:
    _ensure_backend_ai_on_path(backend_ai_root)
    try:
        from models.hybrid_attention_unet import build_model
        from preprocessing.transforms import (
            predict_volume_numpy,
            preprocess_image_array,
        )
    finally:
        _restore_orm_modules()

    config = _load_experiment_config(backend_ai_root, architecture_config)
    image = preprocess_image_array(roi_array, config)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(config).to(device)
    checkpoint = torch.load(weights_path, map_location=device, weights_only=False)
    state_dict = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))
    load_result = model.load_state_dict(state_dict, strict=False)
    if load_result.missing_keys or load_result.unexpected_keys:
        raise RuntimeError(
            "Checkpoint does not match model architecture for "
            f"skip_mode={config.skip_mode!r} (weights={weights_path}): "
            f"{len(load_result.missing_keys)} missing key(s), "
            f"{len(load_result.unexpected_keys)} unexpected key(s). "
            "Predictions from a partially-loaded model are unreliable; "
            "fix ai/configs/*.json skip_mode to match the checkpoint "
            "instead of silently dropping weights."
        )
    model.eval()

    return predict_volume_numpy(model, image, config, device)


def process_volume_study(
    native_array: np.ndarray,
    spacing: tuple[float, float, float],
    *,
    weights_path: Path,
    backend_ai_root: Path,
    output_dir: Path,
    static_mesh_dir: Path,
    study_id: str | None = None,
    architecture_config: dict | None = None,
    architecture_id: str | None = None,
) -> dict[str, Any]:
    """Run hippocampus segmentation on a native-resolution volume."""
    if not weights_path.is_file():
        raise FileNotFoundError(f"Model weights not found: {weights_path}")

    _ensure_backend_ai_on_path(backend_ai_root)
    try:
        from inference.localize import embed_roi_mask, localize_hippocampus_roi
    finally:
        _restore_orm_modules()

    output_dir.mkdir(parents=True, exist_ok=True)

    config = _load_experiment_config(backend_ai_root, architecture_config)

    native = np.asarray(native_array, dtype=np.float32)
    if native.ndim != 3:
        raise NiftiInputError(f"Expected 3D volume, got shape {native.shape}")

    roi_crop = localize_hippocampus_roi(native, spacing, config.roi_size)
    roi_pred = _run_model_on_roi(
        roi_crop.array,
        weights_path=weights_path,
        backend_ai_root=backend_ai_root,
        architecture_config=architecture_config,
    )

    if roi_crop.mode == "native_roi":
        if roi_pred.shape == native.shape:
            pred_native = roi_pred.astype(np.uint8, copy=False)
        else:
            from scipy.ndimage import zoom as ndimage_zoom

            zoom_factors = tuple(n / p for n, p in zip(native.shape, roi_pred.shape))
            pred_native = ndimage_zoom(
                roi_pred.astype(np.float32), zoom_factors, order=0
            ).astype(np.uint8)
            pred_native = pred_native[: native.shape[0], : native.shape[1], : native.shape[2]]
    else:
        pred_native = embed_roi_mask(roi_pred, roi_crop.offset_zyx, native.shape)

    voxel_vol = _voxel_volume_mm3_from_spacing(spacing)
    mesh_base = f"{study_id or uuid.uuid4().hex[:8]}_hippocampus"
    static_mesh_dir.mkdir(parents=True, exist_ok=True)
    mesh_result = generate_mesh_exports(
        pred_native,
        static_mesh_dir,
        spacing,
        volume=native,
        output_basename=mesh_base,
    )

    class_volumes = _class_volumes_ml(pred_native, voxel_vol)
    class_metrics = hippocampus_metrics_to_legacy(class_volumes)

    return {
        "mask": pred_native,
        "preview_mask": pred_native,
        "voxel_volume_mm3": voxel_vol,
        "class_metrics": class_metrics,
        "mesh_url": mesh_result.glb_url,
        "stl_url": mesh_result.stl_url,
        "mesh_path": mesh_result.glb_path,
        "stl_path": mesh_result.stl_path,
        "roi_mode": roi_crop.mode,
        "roi_offset_zyx": list(roi_crop.offset_zyx),
        "native_shape": list(native.shape),
        "spacing_zyx": list(spacing),
        "zonal_distribution": {},
        "dice_score": None,
        "architecture_id": architecture_id,
    }


def process_nifti_study(
    nifti_path: Path,
    *,
    weights_path: Path,
    backend_ai_root: Path,
    output_dir: Path,
    static_mesh_dir: Path,
    study_id: str | None = None,
    architecture_config: dict | None = None,
    architecture_id: str | None = None,
) -> dict[str, Any]:
    """Run hippocampus segmentation on a NIfTI scan."""
    nifti_path = nifti_path.resolve()
    if not nifti_path.is_file():
        raise NiftiInputError(f"NIfTI file not found: {nifti_path}")

    image_nii = nib.load(str(nifti_path))
    array = image_nii.get_fdata(dtype=np.float32)
    if array.ndim == 4:
        array = array[..., 0]
    spacing = _spacing_from_nifti(image_nii)

    return process_volume_study(
        array,
        spacing,
        weights_path=weights_path,
        backend_ai_root=backend_ai_root,
        output_dir=output_dir,
        static_mesh_dir=static_mesh_dir,
        study_id=study_id,
        architecture_config=architecture_config,
        architecture_id=architecture_id,
    )


def process_dicom_study(
    dicom_dir: Path,
    *,
    weights_path: Path,
    backend_ai_root: Path,
    output_dir: Path,
    static_mesh_dir: Path,
    study_id: str | None = None,
    architecture_config: dict | None = None,
    architecture_id: str | None = None,
) -> dict[str, Any]:
    """Run hippocampus segmentation on a sorted DICOM series directory."""
    from services.dicom.series_read import (
        read_sorted_dicom_slices,
        spacing_zyx_mm,
        stack_pixel_volume_zyx_viewer,
    )

    dicom_dir = dicom_dir.resolve()
    if not dicom_dir.is_dir():
        raise NiftiInputError(f"DICOM directory not found: {dicom_dir}")

    slices = read_sorted_dicom_slices(dicom_dir, include_dicom_ext=True)
    if not slices:
        raise NiftiInputError("Study directory contains no DICOM files")

    volume = stack_pixel_volume_zyx_viewer(slices)
    slope = float(getattr(slices[0], "RescaleSlope", 1.0))
    intercept = float(getattr(slices[0], "RescaleIntercept", 0.0))
    if slope != 1.0 or intercept != 0.0:
        volume = volume * slope + intercept

    spacing = spacing_zyx_mm(slices, mode="viewer")

    return process_volume_study(
        volume.astype(np.float32, copy=False),
        spacing,
        weights_path=weights_path,
        backend_ai_root=backend_ai_root,
        output_dir=output_dir,
        static_mesh_dir=static_mesh_dir,
        study_id=study_id,
        architecture_config=architecture_config,
        architecture_id=architecture_id,
    )


__all__ = [
    "NiftiInputError",
    "_ensure_backend_ai_on_path",
    "hippocampus_metrics_to_legacy",
    "process_dicom_study",
    "process_nifti_study",
    "process_volume_study",
]
