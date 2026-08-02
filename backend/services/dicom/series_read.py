"""
Shared DICOM CT series reading: discover files, sort by position, stack pixels, HU rescale, spacing.

Call sites: studies viewer (multiframe-aware pixel stack), segmentation sync (HU + spacing),
AI ``dicom_pipeline`` (upload temp dir, strict PixelSpacing).
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any, List, Literal, Tuple

import numpy as np
import pydicom

__all__ = [
    "apply_hu_rescale",
    "hu_volume_zyx_and_spacing_sync",
    "list_dicom_paths",
    "read_sorted_dicom_slices",
    "spacing_zyx_mm",
    "stack_pixel_volume_zyx_simple",
    "stack_pixel_volume_zyx_viewer",
]

# ---------------------------------------------------------------------------
# Discovery & slice ordering
# ---------------------------------------------------------------------------


def list_dicom_paths(root: Path, *, include_dicom_ext: bool = False) -> List[Path]:
    """
    Collect DICOM paths under ``root``.

    On case-insensitive filesystems (Windows), ``*.dcm`` and ``*.DCM`` match the same
    files, so concatenating both globs would duplicate every slice. De-duplicate by
    resolved path before returning.
    """
    candidates: List[Path] = []
    candidates.extend(root.rglob("*.dcm"))
    candidates.extend(root.rglob("*.DCM"))
    if include_dicom_ext:
        candidates.extend(root.rglob("*.dicom"))
        candidates.extend(root.rglob("*.DICOM"))

    seen: set[str] = set()
    unique: List[Path] = []
    for p in candidates:
        try:
            key = str(p.resolve())
        except OSError:
            key = str(p)
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique


def read_sorted_dicom_slices(
    root: Path, *, include_dicom_ext: bool = False
) -> List[Any]:
    """Load all DICOM datasets under ``root``, sorted by ImagePositionPatient Z (inferior-superior)."""
    files = list_dicom_paths(root, include_dicom_ext=include_dicom_ext)
    if not files:
        return []
    slices = [pydicom.dcmread(str(f)) for f in files]
    slices.sort(
        key=lambda x: float(getattr(x, "ImagePositionPatient", [0, 0, 0])[2])
    )
    return slices


# ---------------------------------------------------------------------------
# Pixel stacking (Z, Y, X)
# ---------------------------------------------------------------------------


def stack_pixel_volume_zyx_simple(slices: List[Any]) -> np.ndarray:
    """One 2D frame per file (typical CT); stack as [Z, Y, X] float32."""
    volume_slices: List[np.ndarray] = []
    for s in slices:
        pixel_arr = s.pixel_array
        if len(pixel_arr.shape) == 3:
            volume_slices.append(pixel_arr[0])
        else:
            volume_slices.append(pixel_arr)
    return np.stack(volume_slices).astype(np.float32)


def stack_pixel_volume_zyx_viewer(slices: List[Any]) -> np.ndarray:
    """
    Same Z,Y,X order as slice overlay; if a file is multi-frame, use the first frame only
    (matches legacy viewer behavior).
    """
    volume_slices: List[np.ndarray] = []
    for s in slices:
        pixel_arr = s.pixel_array
        if len(pixel_arr.shape) == 3:
            volume_slices.append(pixel_arr[0])
        else:
            volume_slices.append(pixel_arr)
    return np.stack(volume_slices).astype(np.float32)


# ---------------------------------------------------------------------------
# HU rescale & spacing
# ---------------------------------------------------------------------------


def apply_hu_rescale(volume: np.ndarray, first_slice: Any) -> np.ndarray:
    """Apply RescaleSlope / RescaleIntercept to raw pixels → HU."""
    return volume * float(getattr(first_slice, "RescaleSlope", 1.0)) + float(
        getattr(first_slice, "RescaleIntercept", 0.0)
    )


def spacing_zyx_mm(
    slices: List[Any],
    *,
    mode: Literal["pipeline", "sync", "viewer"] = "sync",
) -> Tuple[float, float, float]:
    """
    Voxel spacing (z, y, x) in mm for volume index order [Z, Y, X].

    * ``pipeline`` — AI upload path: require ``PixelSpacing``; tuple matches legacy inference (no epsilon floor).
    * ``sync`` — segmentation sync vs DICOM: lenient defaults + ``max(..., 1e-6)``.
    * ``viewer`` — dashboard slice viewer / dicom-shape route defaults.
    """
    if not slices:
        return (1.0, 1.0, 1.0)
    first = slices[0]

    if mode == "pipeline":
        spacing_xy = [float(s) for s in first.PixelSpacing]
    elif mode == "viewer":
        sp = getattr(first, "PixelSpacing", None)
        if sp is not None and len(sp) >= 2:
            spacing_xy = [float(sp[0]), float(sp[1])]
        else:
            spacing_xy = [0.7, 0.7]
    else:
        spacing_xy = [
            float(s) for s in getattr(first, "PixelSpacing", [1.0, 1.0])
        ]

    z_spacing = 0.0
    if len(slices) > 1:
        try:
            z_spacing = abs(
                float(slices[1].ImagePositionPatient[2])
                - float(slices[0].ImagePositionPatient[2])
            )
        except Exception:
            z_spacing = 0.0
    if z_spacing <= 0.0:
        z_spacing = float(getattr(first, "SliceThickness", 1.0))

    if mode == "viewer":
        if z_spacing <= 0.0 or math.isnan(z_spacing):
            z_spacing = 1.0
        sy, sx = spacing_xy[0], spacing_xy[1]
        if sy <= 0.0:
            sy = 1.0
        if sx <= 0.0:
            sx = 1.0
        return (z_spacing, sy, sx)

    if mode == "pipeline":
        return (z_spacing, spacing_xy[0], spacing_xy[1])

    # sync
    return (
        max(z_spacing, 1e-6),
        max(spacing_xy[0], 1e-6),
        max(spacing_xy[1], 1e-6),
    )


def hu_volume_zyx_and_spacing_sync(
    slices: List[Any],
) -> Tuple[np.ndarray, Tuple[float, float, float]]:
    """Sorted slices → HU volume + (z,y,x) spacing for segmentation sync validation."""
    if not slices:
        raise ValueError("No DICOM slices")
    volume = stack_pixel_volume_zyx_simple(slices)
    volume = apply_hu_rescale(volume, slices[0])
    spacing = spacing_zyx_mm(slices, mode="sync")
    return volume, spacing
