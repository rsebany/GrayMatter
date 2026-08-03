"""Stable AI facade: hippocampus NIfTI/DICOM pipeline."""

from __future__ import annotations

from pathlib import Path

from services.ai.constants import CLASS_LABELS, DicomInputError
from services.ai.mesh import (
    MESH_NODE_NAMES,
    MeshExportResult,
    generate_mesh_exports,
    generate_mesh_glb,
)
from services.ai.metrics import (
    build_lobar_label_volume,
    build_zonal_label_volume,
    compute_class_metrics,
    compute_dice_against_ground_truth,
    compute_expert_vs_prediction_dice,
    compute_hippocampus_volume_ml,
    estimate_lobar_distribution,
    estimate_zonal_distribution,
    expert_prediction_compare_diagnostics,
    mask_label_histogram_u8,
)
from services.ai.mri_pipeline import (
    NiftiInputError,
    process_dicom_study,
    process_nifti_study,
    process_volume_study,
)


def process_dicom_zip_dir(
    dicom_dir: Path,
    weights_path: Path,
    *,
    backend_ai_root: Path | None = None,
    output_dir: Path | None = None,
    static_mesh_dir: Path | None = None,
    study_id: str | None = None,
) -> tuple:
    """
    Run DICOM hippocampus pipeline (regression-script compatible return shape).

    Returns ``(mask, spacing, volume, None)`` where spacing is (z, y, x) mm.
    """
    from services.core.paths import BACKEND_AI_ROOT, STATIC_MESH_DIR

    ai_root = backend_ai_root or BACKEND_AI_ROOT
    out = output_dir or (dicom_dir.parent / "outputs")
    mesh_dir = static_mesh_dir or STATIC_MESH_DIR

    result = process_dicom_study(
        dicom_dir,
        weights_path=weights_path,
        backend_ai_root=ai_root,
        output_dir=out,
        static_mesh_dir=mesh_dir,
        study_id=study_id,
    )
    spacing = tuple(result.get("spacing_zyx") or (1.0, 1.0, 1.0))
    return result["mask"], spacing, None, None


__all__ = [
    "CLASS_LABELS",
    "MESH_NODE_NAMES",
    "DicomInputError",
    "MeshExportResult",
    "NiftiInputError",
    "build_lobar_label_volume",
    "build_zonal_label_volume",
    "compute_class_metrics",
    "compute_dice_against_ground_truth",
    "compute_expert_vs_prediction_dice",
    "compute_hippocampus_volume_ml",
    "estimate_lobar_distribution",
    "estimate_zonal_distribution",
    "expert_prediction_compare_diagnostics",
    "generate_mesh_exports",
    "generate_mesh_glb",
    "mask_label_histogram_u8",
    "process_dicom_study",
    "process_dicom_zip_dir",
    "process_nifti_study",
    "process_volume_study",
]
