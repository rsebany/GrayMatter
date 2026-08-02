"""Hippocampus ROI localization for full-brain MRI volumes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Sequence, Tuple

import numpy as np
from scipy import ndimage

VolumeMode = Literal["native_roi", "full_brain"]


@dataclass(frozen=True)
class RoiCrop:
    """A hippocampus-focused sub-volume extracted from a native scan."""

    array: np.ndarray
    offset_zyx: Tuple[int, int, int]
    mode: VolumeMode


def classify_volume_mode(
    shape: Sequence[int],
    roi_size: Sequence[int],
    *,
    tolerance: float = 1.1,
) -> VolumeMode:
    """Treat scans near model ROI size as pre-cropped hippocampus volumes."""
    if len(shape) < 3 or len(roi_size) < 3:
        return "full_brain"
    if all(int(s) <= int(r) * tolerance for s, r in zip(shape[:3], roi_size[:3])):
        return "native_roi"
    return "full_brain"


def brain_mask_from_volume(volume: np.ndarray) -> np.ndarray:
    """Simple brain mask from T1-like intensity (largest foreground component)."""
    vol = np.asarray(volume, dtype=np.float32)
    if not np.any(np.isfinite(vol)):
        return np.zeros(vol.shape, dtype=bool)

    finite = vol[np.isfinite(vol)]
    if finite.size == 0:
        return np.zeros(vol.shape, dtype=bool)

    vmin, vmax = float(finite.min()), float(finite.max())
    if vmax <= vmin:
        return np.zeros(vol.shape, dtype=bool)

    norm = (vol - vmin) / (vmax - vmin)
    thresh = float(np.percentile(norm[np.isfinite(norm)], 25.0))
    rough = norm > thresh
    labeled, count = ndimage.label(rough)
    if count == 0:
        return rough

    sizes = ndimage.sum(rough, labeled, index=range(1, count + 1))
    largest = int(np.argmax(sizes)) + 1
    brain = labeled == largest
    brain = ndimage.binary_closing(brain, iterations=2)
    brain = ndimage.binary_fill_holes(brain)
    return brain.astype(bool, copy=False)


def _roi_size_voxels(
    roi_size: Sequence[int],
    spacing: Sequence[float],
) -> Tuple[int, int, int]:
    """Convert physical ROI size to voxel counts using native spacing."""
    rz, ry, rx = (max(1, int(r)) for r in roi_size[:3])
    sz, sy, sx = (max(float(s), 1e-6) for s in spacing[:3])
    dz = max(1, int(round(rz)))
    dy = max(1, int(round(ry * (sy / sz)))) if sz > 0 else ry
    dx = max(1, int(round(rx * (sx / sz)))) if sz > 0 else rx
    return (dz, dy, dx)


def localize_hippocampus_roi(
    volume: np.ndarray,
    spacing: Sequence[float],
    roi_size: Sequence[int],
) -> RoiCrop:
    """
    Extract a hippocampus-focused ROI from a full-brain volume.

    Heuristic: inferomedial crop in the inferior third of the brain bounding box.
    """
    vol = np.asarray(volume, dtype=np.float32)
    mode = classify_volume_mode(vol.shape, roi_size)
    if mode == "native_roi":
        return RoiCrop(array=vol.copy(), offset_zyx=(0, 0, 0), mode=mode)

    brain = brain_mask_from_volume(vol)
    if not np.any(brain):
        brain = np.ones(vol.shape, dtype=bool)

    coords = np.argwhere(brain)
    z0, y0, x0 = coords.min(axis=0)
    z1, y1, x1 = coords.max(axis=0)
    dz, dy, dx = _roi_size_voxels(roi_size, spacing)
    dz = min(dz, vol.shape[0])
    dy = min(dy, vol.shape[1])
    dx = min(dx, vol.shape[2])

    # Hippocampus sits inferomedial: lower Z, central Y, bilateral medial X.
    z_start = int(z0 + 0.55 * max(z1 - z0 - dz + 1, 0))
    y_start = int(y0 + 0.35 * max(y1 - y0 - dy + 1, 0))
    x_start = int(x0 + 0.30 * max(x1 - x0 - dx + 1, 0))

    z_start = max(0, min(z_start, vol.shape[0] - dz))
    y_start = max(0, min(y_start, vol.shape[1] - dy))
    x_start = max(0, min(x_start, vol.shape[2] - dx))

    crop = vol[z_start : z_start + dz, y_start : y_start + dy, x_start : x_start + dx]
    return RoiCrop(
        array=crop.astype(np.float32, copy=False),
        offset_zyx=(z_start, y_start, x_start),
        mode="full_brain",
    )


def embed_roi_mask(
    roi_mask: np.ndarray,
    offset_zyx: Sequence[int],
    native_shape: Sequence[int],
) -> np.ndarray:
    """Paste ROI prediction labels into a full native mask grid."""
    native = np.zeros(tuple(int(s) for s in native_shape[:3]), dtype=np.uint8)
    roi = np.asarray(roi_mask, dtype=np.uint8)
    z0, y0, x0 = (int(v) for v in offset_zyx[:3])
    dz, dy, dx = roi.shape
    z1, y1, x1 = z0 + dz, y0 + dy, x0 + dx
    if z0 < 0 or y0 < 0 or x0 < 0:
        raise ValueError(f"Invalid ROI offset: {offset_zyx}")
    z1 = min(z1, native.shape[0])
    y1 = min(y1, native.shape[1])
    x1 = min(x1, native.shape[2])
    dz = z1 - z0
    dy = y1 - y0
    dx = x1 - x0
    native[z0:z1, y0:y1, x0:x1] = roi[:dz, :dy, :dx]
    return native


def brain_shell_mask_from_mri(volume: np.ndarray, seg_mask: np.ndarray) -> np.ndarray:
    """Intracranial envelope from MRI brain mask, excluding segmentation foreground."""
    brain = brain_mask_from_volume(volume)
    if not np.any(brain):
        return _fallback_shell_mask(seg_mask)
    shell = ndimage.binary_erosion(brain, iterations=1)
    fg = seg_mask > 0
    shell = shell & ~fg
    if not np.any(shell):
        return _fallback_shell_mask(seg_mask)
    return shell


def _fallback_shell_mask(mask: np.ndarray) -> np.ndarray:
    fg = mask > 0
    if not np.any(fg):
        return np.zeros_like(mask, dtype=bool)
    coords = np.argwhere(fg)
    z0, y0, x0 = coords.min(axis=0)
    z1, y1, x1 = coords.max(axis=0)
    pad = 2
    z0, y0, x0 = [max(0, v - pad) for v in (z0, y0, x0)]
    z1, y1, x1 = [min(s - 1, v + pad) for v, s in zip((z1, y1, x1), mask.shape)]
    shell = np.zeros(mask.shape, dtype=bool)
    shell[z0 : z1 + 1, y0 : y1 + 1, x0 : x1 + 1] = True
    return shell & ~fg
