"""Segmentation and volumetric evaluation metrics."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import numpy as np
import torch
from monai.data import decollate_batch
from monai.metrics import (
    DiceMetric,
    HausdorffDistanceMetric,
    MeanIoU,
    SurfaceDistanceMetric,
)
from monai.transforms import AsDiscrete

CLASS_NAMES = {1: "anterior", 2: "posterior"}


def build_post_transforms(num_classes: int) -> tuple[AsDiscrete, AsDiscrete]:
    post_label_onehot = AsDiscrete(to_onehot=num_classes)
    post_pred_onehot = AsDiscrete(argmax=True, to_onehot=num_classes)
    return post_label_onehot, post_pred_onehot


def _aggregate_metric_values(values: torch.Tensor, prefix: str) -> dict[str, float]:
    clean = torch.nan_to_num(values, nan=float("nan")).flatten()
    if clean.numel() >= 2:
        return {
            f"{prefix}_anterior": float(clean[0].item()),
            f"{prefix}_posterior": float(clean[1].item()),
            f"{prefix}_mean": float(clean.nanmean().item()),
        }
    if clean.numel() == 1:
        scalar = float(clean[0].item())
        return {
            f"{prefix}_anterior": scalar,
            f"{prefix}_posterior": scalar,
            f"{prefix}_mean": scalar,
        }
    return {
        f"{prefix}_anterior": float("nan"),
        f"{prefix}_posterior": float("nan"),
        f"{prefix}_mean": float("nan"),
    }


def _run_monai_metric(metric, y_pred: Sequence, y: Sequence, prefix: str) -> dict[str, float]:
    metric(y_pred=y_pred, y=y)
    out = _aggregate_metric_values(metric.aggregate(), prefix)
    metric.reset()
    return out


def _as_plain_tensor(t: torch.Tensor) -> torch.Tensor:
    """Strip MetaTensor metadata that breaks MONAI decollate_batch on some versions."""
    if hasattr(t, "as_tensor"):
        return t.as_tensor().detach()
    return t.detach()


def _force_scipy_mask_edges() -> None:
    """Route MONAI surface metrics through NumPy/SciPy.

    On Kaggle GPU images, MONAI's CuPy/cuCIM path hits NVRTC compile-cache
    failures (``TypeError: unhashable type: 'list'``). Converting to NumPy
    before ``get_mask_edges`` keeps HD95/ASD on the SciPy path.
    """
    from monai.metrics import utils as monai_metric_utils

    if getattr(monai_metric_utils.get_mask_edges, "_graymatter_numpy", False):
        return

    _orig = monai_metric_utils.get_mask_edges

    def _numpy_get_mask_edges(seg_pred, seg_gt, *args, **kwargs):
        if torch.is_tensor(seg_pred):
            seg_pred = seg_pred.detach().cpu().numpy()
        if torch.is_tensor(seg_gt):
            seg_gt = seg_gt.detach().cpu().numpy()
        # Prefer SciPy path on MONAI versions that still accept this kwarg.
        try:
            return _orig(seg_pred, seg_gt, *args, always_return_as_numpy=True, **{
                k: v for k, v in kwargs.items() if k != "always_return_as_numpy"
            })
        except TypeError:
            return _orig(seg_pred, seg_gt, *args, **{
                k: v for k, v in kwargs.items() if k != "always_return_as_numpy"
            })

    _numpy_get_mask_edges._graymatter_numpy = True  # type: ignore[attr-defined]
    monai_metric_utils.get_mask_edges = _numpy_get_mask_edges


def _prepare_hard_label_batches(
    outputs: torch.Tensor,
    labels: torch.Tensor,
    num_classes: int,
) -> tuple[list, list]:
    """Decode hard labels on CPU to avoid MONAI CuPy/cuCIM NVRTC failures."""
    _force_scipy_mask_edges()
    outputs = _as_plain_tensor(outputs)
    labels = _as_plain_tensor(labels)
    if outputs.shape[2:] != labels.shape[2:]:
        raise ValueError(
            f"Prediction/label spatial mismatch: outputs {tuple(outputs.shape[2:])} "
            f"vs labels {tuple(labels.shape[2:])}."
        )
    post_label_onehot, post_pred = build_post_transforms(num_classes)
    y_pred = [post_pred(o).detach().cpu() for o in decollate_batch(outputs)]
    y = [post_label_onehot(label.long()).detach().cpu() for label in decollate_batch(labels)]
    return y_pred, y


def compute_dice_scores(outputs: torch.Tensor, labels: torch.Tensor, num_classes: int) -> dict[str, float]:
    y_pred, y = _prepare_hard_label_batches(outputs, labels, num_classes)
    return _run_monai_metric(DiceMetric(include_background=False, reduction="mean_batch"), y_pred, y, "dice")


def compute_segmentation_metrics(
    outputs: torch.Tensor,
    labels: torch.Tensor,
    num_classes: int,
) -> dict[str, float]:
    """Hard-label Dice, HD95, ASD, and IoU for foreground classes."""
    y_pred, y = _prepare_hard_label_batches(outputs, labels, num_classes)
    metrics: dict[str, float] = {}
    metrics.update(_run_monai_metric(
        DiceMetric(include_background=False, reduction="mean_batch"), y_pred, y, "dice"
    ))
    metrics.update(_run_monai_metric(
        HausdorffDistanceMetric(include_background=False, percentile=95, reduction="mean_batch"),
        y_pred, y, "hd95",
    ))
    metrics.update(_run_monai_metric(
        SurfaceDistanceMetric(include_background=False, symmetric=True, reduction="mean_batch"),
        y_pred, y, "asd",
    ))
    metrics.update(_run_monai_metric(
        MeanIoU(include_background=False, reduction="mean_batch"), y_pred, y, "iou"
    ))
    return metrics


def spacing_from_nifti(path: str | Path) -> tuple[float, float, float]:
    import nibabel as nib

    img = nib.load(str(path))
    zooms = img.header.get_zooms()[:3]
    return (float(zooms[0]), float(zooms[1]), float(zooms[2]))


def compute_volume_errors(
    pred_mask: np.ndarray,
    gt_mask: np.ndarray,
    spacing: tuple[float, float, float],
) -> dict[str, float]:
    voxel_ml = (spacing[0] * spacing[1] * spacing[2]) / 1000.0
    out: dict[str, float] = {}
    rel_errors: list[float] = []

    for class_id, name in CLASS_NAMES.items():
        gt_vol = float(np.count_nonzero(gt_mask == class_id) * voxel_ml)
        pred_vol = float(np.count_nonzero(pred_mask == class_id) * voxel_ml)
        abs_err = abs(pred_vol - gt_vol)
        rel_err = abs_err / gt_vol if gt_vol > 0 else (0.0 if pred_vol == 0 else float("nan"))
        out[f"vol_gt_{name}_ml"] = gt_vol
        out[f"vol_pred_{name}_ml"] = pred_vol
        out[f"vol_abs_err_{name}_ml"] = abs_err
        out[f"vol_rel_err_{name}"] = rel_err
        if not np.isnan(rel_err):
            rel_errors.append(rel_err)

    gt_total = float(np.count_nonzero(gt_mask > 0) * voxel_ml)
    pred_total = float(np.count_nonzero(pred_mask > 0) * voxel_ml)
    total_abs = abs(pred_total - gt_total)
    total_rel = total_abs / gt_total if gt_total > 0 else (0.0 if pred_total == 0 else float("nan"))
    out["vol_gt_total_ml"] = gt_total
    out["vol_pred_total_ml"] = pred_total
    out["vol_abs_err_total_ml"] = total_abs
    out["vol_rel_err_total"] = total_rel
    out["vol_rel_err_mean"] = float(np.nanmean(rel_errors)) if rel_errors else float("nan")
    return out


def compute_case_metrics(
    outputs: torch.Tensor,
    labels: torch.Tensor,
    num_classes: int,
    label_path: str | Path,
) -> dict[str, float]:
    outputs = _as_plain_tensor(outputs)
    labels = _as_plain_tensor(labels)
    seg_metrics = compute_segmentation_metrics(outputs, labels, num_classes)
    pred_mask = torch.argmax(outputs, dim=1).squeeze(0).cpu().numpy().astype(np.uint8)
    gt_mask = labels.squeeze(0).cpu().numpy().astype(np.uint8)
    if gt_mask.ndim == 4 and gt_mask.shape[0] == 1:
        gt_mask = gt_mask[0]
    vol_metrics = compute_volume_errors(pred_mask, gt_mask, spacing_from_nifti(label_path))
    return {**seg_metrics, **vol_metrics}


def metrics_from_numpy_masks(
    pred_mask: np.ndarray,
    gt_mask: np.ndarray,
    spacing: tuple[float, float, float],
    num_classes: int = 3,
) -> dict[str, float]:
    """Compute metrics from uint8 masks (for expert comparison)."""
    _force_scipy_mask_edges()
    pred_onehot = np.eye(num_classes, dtype=np.float32)[pred_mask]
    gt_onehot = np.eye(num_classes, dtype=np.float32)[gt_mask]
    pred_t = torch.from_numpy(pred_onehot).permute(3, 0, 1, 2).unsqueeze(0)
    gt_t = torch.from_numpy(gt_onehot).permute(3, 0, 1, 2).unsqueeze(0)
    y_pred = list(decollate_batch(pred_t))
    y = list(decollate_batch(gt_t))

    seg: dict[str, float] = {}
    seg.update(_run_monai_metric(
        DiceMetric(include_background=False, reduction="mean_batch"), y_pred, y, "dice"
    ))
    seg.update(_run_monai_metric(
        HausdorffDistanceMetric(include_background=False, percentile=95, reduction="mean_batch"),
        y_pred, y, "hd95",
    ))
    seg.update(_run_monai_metric(
        SurfaceDistanceMetric(include_background=False, symmetric=True, reduction="mean_batch"),
        y_pred, y, "asd",
    ))
    seg.update(_run_monai_metric(
        MeanIoU(include_background=False, reduction="mean_batch"), y_pred, y, "iou"
    ))
    vol = compute_volume_errors(pred_mask, gt_mask, spacing)
    return {**seg, **vol}
