"""Volume I/O helpers using nibabel and SimpleITK."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import nibabel as nib
import numpy as np
import SimpleITK as sitk

from utils import affines_are_compatible


@dataclass
class VolumeMetadata:
    """Metadata extracted from a neuroimaging volume."""

    filename: str
    filepath: str
    dimensions: list[int]
    voxel_spacing: list[float]
    orientation: str
    affine: list[list[float]]
    datatype: str
    num_labels: int | None = None
    label_values: list[int] | None = None
    load_error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dictionary."""
        return {
            "filename": self.filename,
            "filepath": self.filepath,
            "dimensions": self.dimensions,
            "voxel_spacing": self.voxel_spacing,
            "orientation": self.orientation,
            "affine": self.affine,
            "datatype": self.datatype,
            "num_labels": self.num_labels,
            "label_values": self.label_values,
            "load_error": self.load_error,
        }


def load_nifti_image(path: Path) -> nib.Nifti1Image:
    """Load a NIfTI-compatible image with nibabel."""
    return nib.load(str(path))


def get_orientation_codes(image: nib.Nifti1Image) -> str:
    """Return NIfTI orientation codes."""
    return "".join(nib.aff2axcodes(image.affine))


def extract_image_metadata(path: Path, project_relative_path: str) -> VolumeMetadata:
    """Extract metadata from an image volume."""
    try:
        image = load_nifti_image(path)
        header = image.header
        zooms = header.get_zooms()[:3]
        data = image.get_fdata(dtype=np.float32)
        spacing_sitk = sitk_spacing(path)
        if spacing_sitk and len(spacing_sitk) == 3:
            zooms = spacing_sitk
        return VolumeMetadata(
            filename=path.name,
            filepath=project_relative_path,
            dimensions=list(image.shape),
            voxel_spacing=[float(value) for value in zooms],
            orientation=get_orientation_codes(image),
            affine=image.affine.tolist(),
            datatype=str(data.dtype),
        )
    except Exception as exc:  # noqa: BLE001 - capture corruption details for reports
        return VolumeMetadata(
            filename=path.name,
            filepath=project_relative_path,
            dimensions=[],
            voxel_spacing=[],
            orientation="",
            affine=[],
            datatype="",
            load_error=str(exc),
        )


def extract_label_metadata(path: Path, project_relative_path: str) -> tuple[VolumeMetadata, set[int]]:
    """Extract metadata and unique label values from a label volume."""
    try:
        image = load_nifti_image(path)
        data = image.get_fdata()
        unique_values = sorted({int(value) for value in np.unique(data)})
        metadata = VolumeMetadata(
            filename=path.name,
            filepath=project_relative_path,
            dimensions=list(image.shape),
            voxel_spacing=[float(value) for value in image.header.get_zooms()[:3]],
            orientation=get_orientation_codes(image),
            affine=image.affine.tolist(),
            datatype=str(data.dtype),
            num_labels=len(unique_values),
            label_values=unique_values,
        )
        return metadata, set(unique_values)
    except Exception as exc:  # noqa: BLE001
        metadata = VolumeMetadata(
            filename=path.name,
            filepath=project_relative_path,
            dimensions=[],
            voxel_spacing=[],
            orientation="",
            affine=[],
            datatype="",
            load_error=str(exc),
        )
        return metadata, set()


def validate_volume_pair(image_path: Path, label_path: Path) -> dict[str, Any]:
    """
    Validate that an image/label pair can be loaded and is spatially aligned.

    Returns a dictionary with validation status and diagnostic messages.
    """
    result: dict[str, Any] = {
        "image_path": str(image_path),
        "label_path": str(label_path),
        "is_valid": False,
        "errors": [],
        "warnings": [],
    }

    try:
        image = load_nifti_image(image_path)
        label = load_nifti_image(label_path)
    except Exception as exc:  # noqa: BLE001
        result["errors"].append(f"Failed to load volume: {exc}")
        return result

    image_data = image.get_fdata(dtype=np.float32)
    label_data = label.get_fdata()

    if image_data.ndim != 3 or label_data.ndim != 3:
        result["errors"].append("Expected 3D image and label volumes.")

    if image_data.shape != label_data.shape:
        result["errors"].append(
            f"Shape mismatch: image {image_data.shape} vs label {label_data.shape}."
        )

    if not affines_are_compatible(image.affine, label.affine):
        result["warnings"].append("Affine matrices differ between image and label.")

    label_values = sorted({int(value) for value in np.unique(label_data)})
    if len(label_values) == 0:
        result["errors"].append("Label volume contains no values.")
    if len(label_values) == 1 and label_values[0] == 0:
        result["warnings"].append("Label volume contains only background (0).")

    negative_labels = [value for value in label_values if value < 0]
    if negative_labels:
        result["errors"].append(f"Negative label values detected: {negative_labels}")

    if np.isnan(image_data).any() or np.isinf(image_data).any():
        result["errors"].append("Image contains NaN or Inf values.")

    if not result["errors"]:
        result["is_valid"] = True

    return result


def sitk_spacing(path: Path) -> list[float]:
    """Return voxel spacing using SimpleITK as a cross-check."""
    image = sitk.ReadImage(str(path))
    return [float(value) for value in image.GetSpacing()]
