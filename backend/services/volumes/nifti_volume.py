"""NIfTI volume loading for the 2D viewer at native resolution."""

from __future__ import annotations

from pathlib import Path

import nibabel as nib
import numpy as np

from services.ai.mri_pipeline import NiftiInputError


def is_nifti_path(path: Path) -> bool:
    lower = path.name.lower()
    return lower.endswith((".nii.gz", ".nii"))


def load_nifti_preview_volume(
    nifti_path: Path,
    backend_ai_root: Path | None = None,
) -> tuple[np.ndarray, tuple[float, float, float]]:
    """Load native NIfTI voxel data and spacing (no ROI crop)."""
    del backend_ai_root
    nifti_path = nifti_path.resolve()
    if not nifti_path.is_file():
        raise NiftiInputError(f"NIfTI file not found: {nifti_path}")
    if not is_nifti_path(nifti_path):
        raise NiftiInputError(f"Not a NIfTI file: {nifti_path}")

    image_nii = nib.load(str(nifti_path))
    array = image_nii.get_fdata(dtype=np.float32)
    if array.ndim == 4:
        array = array[..., 0]
    if array.ndim != 3:
        raise NiftiInputError(f"Expected 3D volume, got shape {array.shape}")

    zooms = image_nii.header.get_zooms()
    spacing = (
        float(zooms[0]) if len(zooms) > 0 else 1.0,
        float(zooms[1]) if len(zooms) > 1 else 1.0,
        float(zooms[2]) if len(zooms) > 2 else 1.0,
    )
    return array.astype(np.float32, copy=False), spacing
