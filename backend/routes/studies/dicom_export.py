"""Study DICOM ZIP download and PDF report export."""

from __future__ import annotations

import os
import tempfile
import zipfile
from io import BytesIO
from urllib.parse import quote_plus

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse

from auth import TokenPayload, get_current_user, get_owned_study_or_404
from models.db import get_session
from routes.patients.common import _resolve_patient_name
from services.dicom.series_read import list_dicom_paths
from services.studies.pdf import build_ild_study_report_pdf
from .common import (
    DICOM_STORAGE,
    _ensure_study_dicom_dir,
    _resolve_study_nifti_path,
    _study_has_dicom_series,
)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/studies", tags=["studies"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _iter_dicom_zip(study_dicom_dir):
    """Yield ZIP chunks from a temp file (STORED, no compression)."""
    fd, path = tempfile.mkstemp(suffix=".zip")
    try:
        os.close(fd)
        dcm_files = list_dicom_paths(study_dicom_dir, include_dicom_ext=True)
        seen_arcnames: set[str] = set()
        with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as zf:
            for f in dcm_files:
                arcname = str(f.relative_to(study_dicom_dir)).replace("\\", "/")
                if arcname in seen_arcnames:
                    continue
                seen_arcnames.add(arcname)
                zf.write(f, arcname)
        with open(path, "rb") as f_out:
            while chunk := f_out.read(256 * 1024):
                yield chunk
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _viewer_url(study_id: str, patient_external_id: str | None) -> str:
    frontend_base_url = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    url = f"{frontend_base_url}/view2d?studyId={quote_plus(study_id)}"
    if patient_external_id:
        url += f"&patientId={quote_plus(patient_external_id)}"
    return url


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/{study_id}/dicom-zip",
    summary="Download study DICOM series as ZIP",
    name="studies_dicom_zip",
)
async def get_study_dicom_zip(
    study_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    study_dicom_dir = DICOM_STORAGE / study_id
    if not _study_has_dicom_series(study_dicom_dir):
        if _resolve_study_nifti_path(study_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="DICOM series is not available on the server for this study",
            )
        study_dicom_dir = _ensure_study_dicom_dir(study_id)
        if not study_dicom_dir.exists() or not _study_has_dicom_series(study_dicom_dir):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DICOM data not found on disk")
    if not list_dicom_paths(study_dicom_dir, include_dicom_ext=True):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study directory contains no DICOM files",
        )
    return StreamingResponse(
        _iter_dicom_zip(study_dicom_dir),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=study_{study_id}.zip"},
    )


@router.get(
    "/{study_id}/nifti",
    summary="Download study NIfTI volume",
    name="studies_nifti",
)
async def get_study_nifti(
    study_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    nifti_path = _resolve_study_nifti_path(study_id)
    if not nifti_path or not nifti_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NIfTI volume is not available on the server for this study",
        )

    suffix = "".join(nifti_path.suffixes) or nifti_path.suffix
    media_type = "application/gzip" if suffix.endswith(".gz") else "application/octet-stream"
    return FileResponse(
        nifti_path,
        media_type=media_type,
        filename=f"study_{study_id}{suffix}",
    )


@router.get(
    "/{study_id}/report-pdf",
    summary="Download one-page ILD study PDF (QR to viewer)",
    name="studies_report_pdf",
)
async def get_study_report_pdf(
    study_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    with get_session() as session:
        study = get_owned_study_or_404(session, study_id, current_user)
        if not study.segmentation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cannot generate report: study metrics are not available yet",
            )

        seg = study.segmentation
        patient_name = _resolve_patient_name(
            study.patient.name if study.patient else None,
            study.patient.external_id if study.patient else "Unknown",
        )
        created_at = study.created_at.strftime("%Y-%m-%d %H:%M") if study.created_at else "N/A"
        patient_external_id = study.patient.external_id if study.patient else None
        per_class = [
            ("GGO", seg.ggo_volume_ml),
            ("Reticulation", seg.reticulation_volume_ml),
            ("Consolidation", seg.consolidation_volume_ml),
        ]
        zonal = seg.zonal_distribution or {}
        study_url = _viewer_url(study_id, patient_external_id)

    pdf_bytes = build_ild_study_report_pdf(
        study_id=study_id,
        patient_name=patient_name,
        acquisition_label=created_at,
        total_ild_volume_ml=float(seg.total_ild_volume_ml or 0.0),
        ild_burden_fraction=float(seg.ild_fraction or 0.0),
        lung_volume_ml=float(seg.lung_volume_ml or 0.0),
        zonal_distribution=zonal,
        per_class_volumes=per_class,
        viewer_url_for_qr=study_url,
    )
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="study_{study_id}_report.pdf"'},
    )
