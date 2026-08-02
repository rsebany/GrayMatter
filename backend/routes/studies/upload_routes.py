"""Study upload and expert-mask comparison endpoints."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from auth import TokenPayload, get_current_user, get_owned_study_or_404
from models.db import get_session
from schemas import ExpertMaskCompareResponse, UploadStudyResponse
from services.studies.analysis_state import MASK_STORAGE
from services.studies.expert_mask_compare import run_expert_mask_compare_from_upload
from services.studies.upload import upload_study_impl

from .common import (
    BACKEND_AI_ROOT,
    BASE_DIR,
    DICOM_STORAGE,
    NIFTI_STORAGE,
    STATIC_MESH_DIR,
    _legacy_patient_json,
)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/studies", tags=["studies"])
_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _close_upload_parts(
    file: UploadFile | None,
    files: list[UploadFile] | None,
    *,
    log_label: str,
) -> None:
    if file is not None:
        try:
            await file.close()
        except Exception:
            _log.debug("%s file.close failed", log_label, exc_info=True)
    if files:
        for part in files:
            try:
                await part.close()
            except Exception:
                _log.debug("%s part.close failed", log_label, exc_info=True)


def _build_study_description(
    study_description: str | None,
    modality: str | None,
) -> str | None:
    if not modality:
        return study_description
    description = (study_description or "").strip()
    modality_txt = modality.strip()
    return f"{description} [{modality_txt}]".strip() if description else f"[{modality_txt}]"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/upload/expert-mask-compare",
    response_model=ExpertMaskCompareResponse,
    name="studies_upload_expert_mask_compare",
    summary="Compare expert mask DICOMs to stored AI prediction",
    description=(
        "Upload a ZIP or multiple DICOM slices of an expert label map (0–3 per voxel). "
        "Volume must match the stored prediction mask shape for ``study_id``."
    ),
)
async def compare_expert_mask_to_prediction(
    study_id: Annotated[str, Form(description="Existing study id, e.g. ST-abc12345")],
    file: UploadFile | None = File(
        default=None,
        description="ZIP of expert mask DICOMs (omit if sending `files`)",
    ),
    files: list[UploadFile] | None = File(
        default=None,
        description="Multiple expert mask .dcm/.dicom files",
    ),
    current_user: TokenPayload = Depends(get_current_user),
) -> ExpertMaskCompareResponse:
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    try:
        payload = await run_expert_mask_compare_from_upload(
            study_id=study_id,
            mask_storage=MASK_STORAGE,
            base_tmp=BASE_DIR,
            file=file,
            files=files,
        )
        return ExpertMaskCompareResponse.model_validate(payload)
    finally:
        await _close_upload_parts(file, files, log_label="expert-mask-compare")


@router.post(
    "/upload",
    response_model=UploadStudyResponse,
    name="studies_upload_nifti",
    summary="Ingest DICOM or NIfTI MRI, run hippocampus segmentation, persist study",
    description=(
        "Upload a DICOM series (.zip or multiple .dcm files) or a single "
        "`.nii` / `.nii.gz` T1 MRI volume."
    ),
)
async def upload_study(
    file: UploadFile | None = File(
        default=None,
        description="DICOM .zip or hippocampus MRI NIfTI (.nii / .nii.gz)",
    ),
    files: list[UploadFile] | None = File(
        default=None,
        description="DICOM folder (.dcm) or optional single NIfTI file",
    ),
    patient_id: Annotated[str | None, Form()] = None,
    patient_name: Annotated[str | None, Form()] = None,
    date_of_birth: Annotated[str | None, Form()] = None,
    study_description: Annotated[str | None, Form()] = None,
    clinical_notes: Annotated[str | None, Form()] = None,
    modality: Annotated[str | None, Form()] = None,
    architecture: Annotated[str | None, Form()] = None,
    current_user: TokenPayload = Depends(get_current_user),
) -> UploadStudyResponse:
    patient = _legacy_patient_json(
        patient_id=patient_id,
        patient_name=patient_name,
        date_of_birth=date_of_birth,
        clinical_notes=clinical_notes,
    )
    try:
        return await upload_study_impl(
            base_dir=BASE_DIR,
            static_mesh_dir=STATIC_MESH_DIR,
            mask_storage=MASK_STORAGE,
            dicom_storage=DICOM_STORAGE,
            backend_ai_root=BACKEND_AI_ROOT,
            nifti_storage=NIFTI_STORAGE,
            log_prefix="/studies/upload",
            patient=patient,
            file=file,
            files=files,
            study_description=_build_study_description(study_description, modality),
            architecture=architecture,
            current_user=current_user,
        )
    finally:
        await _close_upload_parts(file, files, log_label="upload")
