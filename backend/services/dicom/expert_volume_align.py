"""
Align expert / reference label DICOMs to the study CT grid used for AI inference.

Expert masks are often exported as a separate series with different sort order,
in-plane orientation (L/R flip), or RescaleSlope on label pixels. Stacking by Z
alone can place annotations on the wrong lung even when slice count matches.
"""
from __future__ import annotations

import logging
from typing import Any, Literal

import numpy as np
from scipy.ndimage import zoom

logger = logging.getLogger(__name__)

InplaneFlip = Literal["none", "flip_lr", "flip_ud", "flip_lr_ud"]

__all__ = [
    "auto_correct_inplane_flip",
    "label_pixels_uint8_from_slice",
    "stack_expert_volume_on_ct_grid",
]

# ---------------------------------------------------------------------------
# Slice helpers
# ---------------------------------------------------------------------------


def label_pixels_uint8_from_slice(ds: Any) -> np.ndarray:
    """Categorical label plane; undo RescaleSlope/Intercept when present."""
    pa = ds.pixel_array
    if len(pa.shape) == 3:
        pa = pa[0]
    raw = pa.astype(np.float64, copy=False)
    slope = float(getattr(ds, "RescaleSlope", 1.0) or 1.0)
    intercept = float(getattr(ds, "RescaleIntercept", 0.0) or 0.0)
    if slope != 1.0 or intercept != 0.0:
        raw = (raw - intercept) / slope
    return np.clip(np.rint(raw), 0, 255).astype(np.uint8, copy=False)


def _slice_z_mm(ds: Any) -> float | None:
    ipp = getattr(ds, "ImagePositionPatient", None)
    if ipp is not None and len(ipp) >= 3:
        try:
            return float(ipp[2])
        except (TypeError, ValueError):
            return None
    return None


def _referenced_ct_sop_uid(expert_ds: Any) -> str | None:
    for seq_name in (
        "ReferencedImageSequence",
        "SourceImageSequence",
        "DerivationImageSequence",
    ):
        seq = getattr(expert_ds, seq_name, None)
        if not seq:
            continue
        for item in seq:
            uid = getattr(item, "ReferencedSOPInstanceUID", None)
            if uid:
                return str(uid)
    return None


def _resize_label_plane(plane: np.ndarray, out_h: int, out_w: int) -> np.ndarray:
    h, w = plane.shape
    if h == out_h and w == out_w:
        return plane
    return zoom(plane.astype(np.float32), (out_h / h, out_w / w), order=0).astype(
        np.uint8, copy=False
    )


def _match_expert_slice_to_ct_index(
    expert_ds: Any,
    ct_slices: list[Any],
    ct_uid_to_index: dict[str, int],
    ct_z_list: list[tuple[int, float]],
) -> int | None:
    ref_uid = _referenced_ct_sop_uid(expert_ds)
    if ref_uid and ref_uid in ct_uid_to_index:
        return ct_uid_to_index[ref_uid]

    exp_uid = getattr(expert_ds, "SOPInstanceUID", None)
    if exp_uid and str(exp_uid) in ct_uid_to_index:
        return ct_uid_to_index[str(exp_uid)]

    exp_series = getattr(expert_ds, "SeriesInstanceUID", None)
    exp_inst = getattr(expert_ds, "InstanceNumber", None)
    if exp_series is not None and exp_inst is not None:
        try:
            exp_inst_i = int(exp_inst)
        except (TypeError, ValueError):
            exp_inst_i = None
        if exp_inst_i is not None:
            for i, ct in enumerate(ct_slices):
                if getattr(ct, "SeriesInstanceUID", None) != exp_series:
                    continue
                try:
                    if int(getattr(ct, "InstanceNumber", -1)) == exp_inst_i:
                        return i
                except (TypeError, ValueError):
                    continue

    z = _slice_z_mm(expert_ds)
    if z is not None and ct_z_list:
        best_i: int | None = None
        best_d = float("inf")
        for i, z_ct in ct_z_list:
            d = abs(z - z_ct)
            if d < best_d:
                best_d = d
                best_i = i
        return best_i

    return None


# ---------------------------------------------------------------------------
# CT grid alignment & in-plane correction
# ---------------------------------------------------------------------------


def stack_expert_volume_on_ct_grid(
    expert_slices: list[Any],
    ct_slices: list[Any],
) -> tuple[np.ndarray, dict[str, Any]]:
    """
    Build [Z, Y, X] uint8 expert volume with Z aligned to ``ct_slices`` order.

    Each expert file is placed on the matching CT slice index (by referenced SOP,
    instance number, or nearest ImagePositionPatient Z).
    """
    if not ct_slices:
        raise ValueError("ct_slices is empty")

    ct0 = ct_slices[0]
    pa0 = ct0.pixel_array
    if len(pa0.shape) == 3:
        pa0 = pa0[0]
    out_h, out_w = int(pa0.shape[0]), int(pa0.shape[1])
    depth = len(ct_slices)

    ct_uid_to_index: dict[str, int] = {}
    ct_z_list: list[tuple[int, float]] = []
    for i, ct in enumerate(ct_slices):
        uid = getattr(ct, "SOPInstanceUID", None)
        if uid:
            ct_uid_to_index[str(uid)] = i
        z = _slice_z_mm(ct)
        if z is not None:
            ct_z_list.append((i, z))

    vol = np.zeros((depth, out_h, out_w), dtype=np.uint8)
    matched = 0
    unmatched = 0
    for es in expert_slices:
        idx = _match_expert_slice_to_ct_index(
            es, ct_slices, ct_uid_to_index, ct_z_list
        )
        plane = label_pixels_uint8_from_slice(es)
        plane = _resize_label_plane(plane, out_h, out_w)
        if idx is None:
            unmatched += 1
            continue
        # If multiple expert files map to one CT slice, keep max label (union).
        prev = vol[idx]
        vol[idx] = np.maximum(prev, plane)
        matched += 1

    meta: dict[str, Any] = {
        "expert_stack_mode": "ct_grid",
        "expert_slices_matched": matched,
        "expert_slices_unmatched": unmatched,
        "expert_ct_depth": depth,
        "expert_upload_count": len(expert_slices),
    }
    if unmatched > 0:
        meta["expert_stack_warning"] = (
            f"{unmatched} expert file(s) could not be matched to a CT slice; "
            "those planes were left empty."
        )
    return vol, meta


# ---------------------------------------------------------------------------
# Orientation fix (expert compare only)
# ---------------------------------------------------------------------------


def auto_correct_inplane_flip(
    expert: np.ndarray,
    reference: np.ndarray,
    *,
    min_gain_voxels: int = 50,
) -> tuple[np.ndarray, InplaneFlip, int]:
    """
    Pick in-plane flip that maximizes foreground overlap with ``reference`` (AI mask).

    Fixes common L/R flips between SEG export and the study CT stack.
    Called from ``expert_mask_compare.compare_expert_dicom_to_prediction_volume``.
    """
    ref_fg = reference > 0
    if not np.any(ref_fg) or not np.any(expert > 0):
        return expert, "none", 0

    def _overlap(vol: np.ndarray) -> int:
        return int(np.count_nonzero((vol > 0) & ref_fg))

    best_vol = expert
    best_mode: InplaneFlip = "none"
    best_ol = _overlap(expert)
    baseline = best_ol

    candidates: list[tuple[InplaneFlip, np.ndarray]] = [
        ("flip_lr", np.flip(expert, axis=2)),
        ("flip_ud", np.flip(expert, axis=1)),
        ("flip_lr_ud", np.flip(np.flip(expert, axis=2), axis=1)),
    ]
    for mode, vol in candidates:
        ol = _overlap(vol)
        if ol > best_ol:
            best_ol = ol
            best_vol = vol
            best_mode = mode

    gain = best_ol - baseline
    if best_mode == "none":
        return expert, "none", 0
    # Apply flip when overlap clearly improves (absolute gain or relative when baseline > 0).
    if baseline == 0:
        if best_ol <= 0:
            return expert, "none", 0
        return best_vol, best_mode, gain
    rel_gain = gain / float(baseline)
    if gain < min_gain_voxels and rel_gain < 0.25:
        return expert, "none", 0
    return best_vol, best_mode, gain
