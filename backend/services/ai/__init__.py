"""Hippocampus MRI: DICOM/NIfTI → U-Net → metrics / mesh (GLB + STL)."""
from __future__ import annotations

from services.ai.geometry import resample_mask_to_shape as _resample_mask_to_shape
from services.ai.inference import (
    CLASS_LABELS,
    MESH_NODE_NAMES,
    DicomInputError,
    MeshExportResult,
    build_lobar_label_volume,
    build_zonal_label_volume,
    compute_class_metrics,
    compute_dice_against_ground_truth,
    compute_hippocampus_volume_ml,
    estimate_lobar_distribution,
    estimate_zonal_distribution,
    generate_mesh_exports,
    generate_mesh_glb,
    process_dicom_study,
    process_dicom_zip_dir,
    process_nifti_study,
    process_volume_study,
)

__all__ = [
    "CLASS_LABELS",
    "MESH_NODE_NAMES",
    "DicomInputError",
    "MeshExportResult",
    "_resample_mask_to_shape",
    "build_lobar_label_volume",
    "build_zonal_label_volume",
    "compute_class_metrics",
    "compute_dice_against_ground_truth",
    "compute_hippocampus_volume_ml",
    "estimate_lobar_distribution",
    "estimate_zonal_distribution",
    "generate_mesh_exports",
    "generate_mesh_glb",
    "process_dicom_study",
    "process_dicom_zip_dir",
    "process_nifti_study",
    "process_volume_study",
]
