"""Hippocampus segmentation metrics and expert-vs-AI Dice."""
from __future__ import annotations

from typing import Dict, Optional, Tuple

import numpy as np

from services.ai.constants import CLASS_LABELS, LEGACY_VOLUME_KEYS

__all__ = [
    "build_lobar_label_volume",
    "build_zonal_label_volume",
    "compute_class_metrics",
    "compute_dice_against_ground_truth",
    "compute_expert_vs_prediction_dice",
    "compute_hippocampus_volume_ml",
    "estimate_lobar_distribution",
    "estimate_zonal_distribution",
    "expert_prediction_compare_diagnostics",
    "mask_label_histogram_u8",
]

def compute_hippocampus_volume_ml(mask: np.ndarray, spacing: Tuple[float, float, float]) -> float:
    voxel_vol_mm3 = spacing[0] * spacing[1] * spacing[2]
    vol_ml = (np.count_nonzero(mask > 0) * voxel_vol_mm3) / 1000.0
    return float(round(vol_ml, 4))


def compute_class_metrics(
    mask: np.ndarray,
    spacing: Tuple[float, float, float],
    lung_mask: Optional[np.ndarray] = None,
) -> Dict[str, float]:
    del lung_mask
    voxel_vol_mm3 = float(spacing[0] * spacing[1] * spacing[2])
    metrics: Dict[str, float] = {}
    total_fg_voxels = 0

    for label_id, key in CLASS_LABELS.items():
        n_voxels = int(np.count_nonzero(mask == label_id))
        total_fg_voxels += n_voxels
        legacy_key = LEGACY_VOLUME_KEYS[key]
        metrics[legacy_key] = float(round((n_voxels * voxel_vol_mm3) / 1000.0, 4))

    total_ml = float(round((total_fg_voxels * voxel_vol_mm3) / 1000.0, 4))
    metrics["total_ild_volume_ml"] = total_ml
    metrics["hippocampus_volume_ml"] = total_ml

    brain_voxels = max(int(mask.size), 1)
    ref_ml = float(round((brain_voxels * voxel_vol_mm3) / 1000.0, 4))
    metrics["lung_volume_ml"] = ref_ml

    def _safe_burden(class_volume_ml: float) -> float:
        if total_ml <= 0:
            return 0.0
        return float(round(min(1.0, class_volume_ml / total_ml), 6))

    metrics["ggo_burden"] = _safe_burden(metrics["ggo_volume_ml"])
    metrics["reticulation_burden"] = _safe_burden(metrics["reticulation_volume_ml"])
    metrics["consolidation_volume_ml"] = 0.0
    metrics["consolidation_burden"] = 0.0
    metrics["ild_burden"] = _safe_burden(total_ml)
    metrics["hippocampus_burden"] = metrics["ild_burden"]
    metrics["left_hippocampus_ml"] = metrics["ggo_volume_ml"]
    metrics["right_hippocampus_ml"] = metrics["reticulation_volume_ml"]
    return metrics


def build_zonal_label_volume(mask: np.ndarray) -> np.ndarray:
    labels = np.zeros(mask.shape, dtype=np.uint8)
    slice_sums = np.sum(mask > 0, axis=(1, 2))
    occupied_indices = np.where(slice_sums > 0)[0]
    if len(occupied_indices) == 0:
        return labels

    start_z, end_z = int(occupied_indices[0]), int(occupied_indices[-1])
    active_range = end_z - start_z + 1
    third = active_range // 3

    for z in range(start_z, min(start_z + third, end_z + 1)):
        labels[z] = np.where(mask[z] > 0, 1, 0)
    for z in range(start_z + third, min(start_z + 2 * third, end_z + 1)):
        labels[z] = np.where(mask[z] > 0, 2, 0)
    for z in range(start_z + 2 * third, end_z + 1):
        labels[z] = np.where(mask[z] > 0, 3, 0)
    return labels


def estimate_zonal_distribution(mask: np.ndarray) -> Dict[str, float]:
    labels = build_zonal_label_volume(mask)
    counts = {
        "Upper": int(np.count_nonzero(labels == 1)),
        "Middle": int(np.count_nonzero(labels == 2)),
        "Lower": int(np.count_nonzero(labels == 3)),
    }
    total = sum(counts.values())
    if total == 0:
        return {"Upper": 0.0, "Middle": 0.0, "Lower": 0.0}
    return {k: round((v / total) * 100, 2) for k, v in counts.items()}


build_lobar_label_volume = build_zonal_label_volume
estimate_lobar_distribution = estimate_zonal_distribution


def compute_dice_against_ground_truth(study_id: str, mask: np.ndarray) -> Optional[float]:
    del study_id, mask
    return None


def _dice_binary_mask(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=bool).ravel()
    b = np.asarray(b, dtype=bool).ravel()
    sa, sb = int(a.sum()), int(b.sum())
    if sa == 0 and sb == 0:
        return 1.0
    if sa == 0 or sb == 0:
        return 0.0
    inter = int(np.logical_and(a, b).sum())
    return 2.0 * inter / float(sa + sb)


def mask_label_histogram_u8(vol: np.ndarray, *, max_label: int = 2) -> Dict[str, int]:
    v = np.asarray(vol, dtype=np.uint8).ravel()
    return {str(i): int(np.count_nonzero(v == i)) for i in range(max_label + 1)}


def expert_prediction_compare_diagnostics(
    expert: np.ndarray,
    prediction: np.ndarray,
) -> Dict[str, object]:
    ex = np.asarray(expert, dtype=np.uint8)
    pr = np.asarray(prediction, dtype=np.uint8)
    dice_vacuous: Dict[str, bool] = {}
    for label_id, key in CLASS_LABELS.items():
        dice_vacuous[key] = bool(
            np.count_nonzero(ex == label_id) == 0
            and np.count_nonzero(pr == label_id) == 0
        )

    ex_fg = ex > 0
    pr_fg = pr > 0
    overlap = int(np.count_nonzero(np.logical_and(ex_fg, pr_fg)))
    ex_n = int(np.count_nonzero(ex_fg))
    pr_n = int(np.count_nonzero(pr_fg))
    agree = int(np.count_nonzero(ex == pr))
    total = int(ex.size)

    hint: str | None = None
    if ex_n > 0 and pr_n > 0 and overlap == 0:
        hint = (
            "Expert foreground and AI foreground do not overlap on any voxel. "
            "Check slice order, grid alignment, or label semantics (1=left, 2=right hippocampus)."
        )
    elif ex_n == 0 and pr_n > 0:
        hint = "Expert mask has no foreground; AI mask has hippocampus labels."
    elif ex_n > 0 and pr_n == 0:
        hint = "AI mask has no foreground; expert has labels. Re-run AI if needed."

    return {
        "voxel_count_expert": mask_label_histogram_u8(ex),
        "voxel_count_prediction": mask_label_histogram_u8(pr),
        "dice_vacuous_both_empty": dice_vacuous,
        "foreground_overlap_voxels": overlap,
        "expert_foreground_voxels": ex_n,
        "prediction_foreground_voxels": pr_n,
        "voxel_agreement_fraction": float(agree / total) if total else 0.0,
        "interpretation_hint": hint,
    }


def compute_expert_vs_prediction_dice(
    ground_truth: np.ndarray,
    prediction: np.ndarray,
) -> Dict[str, float]:
    if ground_truth.shape != prediction.shape:
        raise ValueError(
            f"Shape mismatch: expert {ground_truth.shape} vs prediction {prediction.shape}"
        )
    gt = ground_truth.astype(np.uint8, copy=False)
    pr = prediction.astype(np.uint8, copy=False)
    out: Dict[str, float] = {}
    dices: list[float] = []
    for label_id, key in CLASS_LABELS.items():
        d = _dice_binary_mask(gt == label_id, pr == label_id)
        out[f"dice_{key}"] = float(round(d, 6))
        dices.append(d)
    out["dice_mean_lesion"] = float(round(float(np.mean(dices)), 6)) if dices else 0.0
    out["dice_any_hippocampus"] = float(round(_dice_binary_mask(gt > 0, pr > 0), 6))
    out["dice_any_ild"] = out["dice_any_hippocampus"]
    return out
