"""Study upload: DICOM or NIfTI MRI → hippocampus segmentation → DB, mask, mesh, and analysis cache."""
from __future__ import annotations

import json
import logging
import math
import shutil
import uuid
from datetime import date
from pathlib import Path
from typing import Annotated, Any

import numpy as np
from auth import (
    TokenPayload,
    assert_patient_access,
    get_current_user_optional,
    get_owned_patient_or_404,
    user_id_from_token,
)
from fastapi import Depends, File, Form, HTTPException, UploadFile
from models.db import get_session
from models.models import PatientORM, SegmentationResultORM, StudyORM, XRViewORM
from pydantic import ValidationError
from schemas import Patient, SegmentationResult, Study, UploadStudyResponse, XRView
from sqlalchemy.exc import IntegrityError

from services.ai.architecture_registry import resolve_architecture
from services.ai.inference import (
    DicomInputError,
    NiftiInputError,
    process_dicom_study,
    process_nifti_study,
)
from services.dicom.series_read import read_sorted_dicom_slices
from services.notifications.service import notify_ai_analysis_complete
from services.patients.ids import generate_patient_external_id
from services.studies.dicom_upload_helpers import (
    classify_imaging_upload,
    materialize_dicom_upload_to_dir,
    persist_dicom_series,
)
from services.studies.nifti_upload_helpers import (
    normalize_nifti_upload,
    persist_nifti_upload,
)

__all__ = ["upload_study_impl"]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mask persistence & metric sanitization
# ---------------------------------------------------------------------------


def _save_mask_to_disk(mask_storage: Path, study_ext_id: str, mask: np.ndarray) -> str:
    mask_storage.mkdir(parents=True, exist_ok=True)
    file_path = mask_storage / f"{study_ext_id}.npy"
    np.save(file_path, mask.astype("uint8"))
    return str(file_path)


def _safe_float(
    value: Any,
    *,
    default: float = 0.0,
    minimum: float = 0.0,
    maximum: float | None = None,
) -> float:
    """Finite, JSON- and Pydantic-friendly floats for API / DB persistence."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(v):
        return default
    if v < minimum:
        return default
    if maximum is not None and v > maximum:
        return maximum
    return v


def _sanitize_class_metrics(raw: dict[str, Any]) -> dict[str, float]:
    """Coerce segmentation metrics so ORM + ``SegmentationResult`` validators never see NaN/inf."""
    m = {**raw}
    for key in (
        "total_ild_volume_ml",
        "lung_volume_ml",
        "ggo_volume_ml",
        "reticulation_volume_ml",
        "consolidation_volume_ml",
    ):
        m[key] = _safe_float(m.get(key), default=0.0, minimum=0.0)
    for key in ("ggo_burden", "reticulation_burden", "consolidation_burden", "ild_burden"):
        m[key] = _safe_float(m.get(key), default=0.0, minimum=0.0, maximum=1.0)
    return m  # type: ignore[return-value]


def _sanitize_zonal(raw: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    for key in ("Upper", "Middle", "Lower"):
        out[key] = _safe_float(raw.get(key), default=0.0, minimum=0.0, maximum=100.0)
    return out


_PLACEHOLDER_PATIENT_NAMES = frozenset(
    {
        "unknown",
        "unknown patient",
        "patient-unknown",
        "anonymous",
        "anonymized",
        "anonymised",
    }
)


# ---------------------------------------------------------------------------
# DICOM patient metadata extraction
# ---------------------------------------------------------------------------


def _is_placeholder_patient_name(value: str | None) -> bool:
    normalized = (value or "").strip().lower()
    return normalized in _PLACEHOLDER_PATIENT_NAMES


def _is_meaningful_patient_name(value: str | None) -> bool:
    return bool((value or "").strip()) and not _is_placeholder_patient_name(value)


def _format_dicom_person_name(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if "^" not in raw:
        return raw
    parts = [part.strip() for part in raw.split("^") if part.strip()]
    if not parts:
        return ""
    # PersonName is commonly Family^Given^Middle^Prefix^Suffix; display human-friendly.
    return " ".join(parts[1:] + parts[:1]).strip()


def _format_dicom_birth_date(value: Any) -> str:
    raw = str(value or "").strip()
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
    return ""


def _registry_patient_display_name(external_id: str | None) -> str | None:
    """Return the name stored for a registry patient when linking by external_id (not from DICOM)."""
    eid = (external_id or "").strip()
    if not eid or eid == "patient-unknown":
        return None
    try:
        with get_session() as session:
            row = session.query(PatientORM).filter(PatientORM.external_id == eid).first()
            if row is None:
                return None
            candidate = (row.name or "").strip()
            if candidate and not _is_placeholder_patient_name(candidate):
                return candidate
    except Exception:  # noqa: BLE001
        return None
    return None


def _extract_patient_metadata_from_dicom(temp_dir: Path) -> dict[str, str]:
    try:
        slices = read_sorted_dicom_slices(temp_dir, include_dicom_ext=True)
    except Exception:  # noqa: BLE001
        return {}
    if not slices:
        return {}

    first = slices[0]
    patient_id = str(getattr(first, "PatientID", "") or "").strip()
    patient_name = _format_dicom_person_name(getattr(first, "PatientName", ""))
    birth_date = _format_dicom_birth_date(getattr(first, "PatientBirthDate", ""))
    sex = str(getattr(first, "PatientSex", "") or "").strip().upper()[:1]

    payload: dict[str, str] = {}
    if patient_id:
        payload["id"] = patient_id
    if patient_name and not _is_placeholder_patient_name(patient_name):
        payload["name"] = patient_name
    if birth_date:
        payload["dob"] = birth_date
    if sex:
        payload["sex"] = sex
    return payload


def _normalize_dicom_upload(
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> tuple[UploadFile | None, list[UploadFile] | None]:
    """
    Single source of truth for DICOM input: one .zip *or* multiple DICOMs.

    * **ZIP** — one archive (series often distributed as a single .zip).
    * **Files / "folder"** — browsers have no true folder upload; a directory is sent as
      many `files` parts (e.g. multi-select or `webkitdirectory`). We accept only
      .dcm/.dicom and disambiguate names in the write loop.
    """
    dicom_files = [f for f in (files or []) if f and (f.filename or "").strip()]
    has_zip = file is not None and bool((file.filename or "").strip())
    if has_zip and dicom_files:
        raise HTTPException(
            status_code=400,
            detail="Provide either a .zip in `file` or multiple DICOMs in `files`, not both.",
        )
    if not has_zip and not dicom_files:
        raise HTTPException(
            status_code=400,
            detail="No imaging data. Upload a .zip of DICOMs or multiple .dcm/.dicom files (folder = multi-file).",
        )
    if has_zip and not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail="Field `file` must be a .zip containing the DICOM series when used.",
        )
    if has_zip:
        return (file, None)
    return (None, dicom_files)


# ---------------------------------------------------------------------------
# Upload orchestration
# ---------------------------------------------------------------------------


async def upload_study_impl(
    *,
    base_dir: Path,
    static_mesh_dir: Path,
    mask_storage: Path,
    dicom_storage: Path,
    backend_ai_root: Path,
    nifti_storage: Path,
    log_prefix: str,
    patient: Annotated[str, Form(description="JSON: {id, name, dob, sex}")],
    file: Annotated[
        UploadFile | None, File(description="DICOM .zip, NIfTI (.nii/.nii.gz), or single DICOM")
    ] = None,
    files: Annotated[
        list[UploadFile] | None, File(description="DICOM folder (.dcm) or optional NIfTI")
    ] = None,
    study_description: Annotated[str | None, Form()] = None,
    architecture: Annotated[str | None, Form()] = None,
    current_user: Annotated[TokenPayload, Depends(get_current_user_optional)],
) -> UploadStudyResponse:
    """Persist an MRI study + hippocampus segmentation with a selectable architecture."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to save data.")

    try:
        arch = resolve_architecture(architecture)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    upload_kind = classify_imaging_upload(file, files)

    session_id = str(uuid.uuid4())
    request_id = f"upload-{session_id[:8]}"
    temp_dir = base_dir / "tmp" / session_id
    study_ext_id = f"ST-{uuid.uuid4().hex[:8]}"
    output_dir = temp_dir / "outputs"
    dicom_patient: dict[str, str] = {}
    stored_volume_path: str | None = None

    try:
        temp_dir.mkdir(parents=True, exist_ok=True)

        if upload_kind == "dicom":
            dicom_file, dicom_files = _normalize_dicom_upload(file, files)
            dicom_temp = temp_dir / "dicom"
            await materialize_dicom_upload_to_dir(dicom_temp, dicom_file, dicom_files)
            dicom_patient = _extract_patient_metadata_from_dicom(dicom_temp)
            if not read_sorted_dicom_slices(dicom_temp, include_dicom_ext=True):
                raise HTTPException(status_code=400, detail="No DICOM slices found in upload.")

            try:
                ai_result = process_dicom_study(
                    dicom_temp,
                    weights_path=arch.checkpoint_path,
                    backend_ai_root=backend_ai_root,
                    output_dir=output_dir,
                    static_mesh_dir=static_mesh_dir,
                    study_id=study_ext_id,
                    architecture_config=arch.config,
                    architecture_id=arch.id,
                )
            except (NiftiInputError, DicomInputError) as e:
                logger.exception(
                    "DICOM validation error in %s/upload [request_id=%s]",
                    log_prefix,
                    request_id,
                )
                raise HTTPException(status_code=400, detail=str(e)) from e
            except FileNotFoundError as e:
                raise HTTPException(status_code=503, detail=str(e)) from e
            except Exception:
                logger.exception(
                    "Unhandled DICOM processing error in %s/upload [request_id=%s]",
                    log_prefix,
                    request_id,
                )
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Internal MRI processing error. "
                        f"Please retry or contact support with request_id={request_id}."
                    ),
                ) from None

            study_dicom_dir = dicom_storage / study_ext_id
            persist_dicom_series(dicom_temp, study_dicom_dir)
            stored_volume_path = str(study_dicom_dir)
        else:
            nifti_upload = normalize_nifti_upload(file, files)
            nifti_path = await persist_nifti_upload(nifti_upload, temp_dir)

            try:
                ai_result = process_nifti_study(
                    nifti_path,
                    weights_path=arch.checkpoint_path,
                    backend_ai_root=backend_ai_root,
                    output_dir=output_dir,
                    static_mesh_dir=static_mesh_dir,
                    study_id=study_ext_id,
                    architecture_config=arch.config,
                    architecture_id=arch.id,
                )
            except NiftiInputError as e:
                logger.exception(
                    "NIfTI validation error in %s/upload [request_id=%s]",
                    log_prefix,
                    request_id,
                )
                raise HTTPException(status_code=400, detail=str(e)) from e
            except FileNotFoundError as e:
                raise HTTPException(status_code=503, detail=str(e)) from e
            except Exception:
                logger.exception(
                    "Unhandled NIfTI processing error in %s/upload [request_id=%s]",
                    log_prefix,
                    request_id,
                )
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Internal MRI processing error. "
                        f"Please retry or contact support with request_id={request_id}."
                    ),
                ) from None

            study_nifti_dir = nifti_storage / study_ext_id
            study_nifti_dir.mkdir(parents=True, exist_ok=True)
            stored_nifti = study_nifti_dir / nifti_path.name
            try:
                shutil.copy2(nifti_path, stored_nifti)
            except OSError as exc:
                logger.exception("copy failed in %s/upload [request_id=%s]", log_prefix, request_id)
                raise HTTPException(
                    status_code=500,
                    detail=f"Could not persist NIfTI to storage: {exc}",
                ) from exc
            stored_volume_path = str(stored_nifti)

        mask = ai_result["mask"]
        class_metrics = _sanitize_class_metrics(ai_result["class_metrics"])
        zonal_dist = _sanitize_zonal(ai_result.get("zonal_distribution") or {})
        mesh_url = ai_result.get("mesh_url") or ""
        stl_url = ai_result.get("stl_url") or ""
        total_vol = float(class_metrics.get("total_ild_volume_ml", 0.0) or 0.0)
        dice_score = ai_result.get("dice_score")

        try:
            payload = json.loads(patient)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid 'patient' JSON payload: {e.msg}",
            ) from e

        dicom_patient = dicom_patient if upload_kind == "dicom" else {}
        explicit_patient_id = str(payload.get("id") or "").strip()
        form_incoming_name = str(payload.get("name") or "").strip()
        incoming_dob = str(payload.get("dob") or "").strip()
        incoming_sex = str(payload.get("sex") or "").strip().upper()[:1]

        # Link only when the client sent a registry id (patient picker).
        # New-patient intake must not reuse DICOM PatientID — that would attach
        # the study to whoever already owns that id in the database.
        is_registry_link = bool(
            explicit_patient_id and explicit_patient_id != "patient-unknown"
        )
        if is_registry_link:
            payload["id"] = explicit_patient_id
        else:
            payload["id"] = generate_patient_external_id()

        resolved_id = str(payload.get("id") or "").strip()

        if _is_meaningful_patient_name(form_incoming_name):
            payload["name"] = form_incoming_name
        else:
            registry_link_id = explicit_patient_id if is_registry_link else ""
            registry_name = (
                _registry_patient_display_name(registry_link_id) if registry_link_id else None
            )
            if registry_name:
                payload["name"] = registry_name
            else:
                dicom_name = str(dicom_patient.get("name", "") or "").strip()
                if dicom_name and not _is_placeholder_patient_name(dicom_name):
                    payload["name"] = dicom_name
                else:
                    payload["name"] = resolved_id or "Unknown"
        if not incoming_dob:
            payload["dob"] = dicom_patient.get("dob", "")
        if not incoming_sex:
            payload["sex"] = dicom_patient.get("sex", "U")

        mask_path = _save_mask_to_disk(mask_storage, study_ext_id, mask)

        if not stored_volume_path:
            raise HTTPException(status_code=500, detail="Volume path was not set after upload.")

        user_db_id = user_id_from_token(current_user)

        try:
            with get_session() as session:
                p_ext_id = payload.get("id") or generate_patient_external_id()
                if is_registry_link:
                    patient_orm = get_owned_patient_or_404(session, p_ext_id, current_user)
                else:
                    patient_orm = (
                        session.query(PatientORM)
                        .filter(PatientORM.external_id == p_ext_id)
                        .first()
                    )
                if not patient_orm:
                    dob_value = payload.get("dob")
                    parsed_dob = date(1900, 1, 1)
                    if dob_value:
                        try:
                            parsed_dob = date.fromisoformat(dob_value)
                        except (TypeError, ValueError):
                            parsed_dob = date(1900, 1, 1)

                    patient_orm = PatientORM(
                        external_id=p_ext_id,
                        name=payload.get("name", "Unknown"),
                        date_of_birth=parsed_dob,
                        sex=payload.get("sex", "U"),
                        user_id=user_db_id,
                    )
                    session.add(patient_orm)
                    session.flush()
                else:
                    assert_patient_access(session, patient_orm, current_user)
                    merged_display_name = str(payload.get("name") or "").strip()
                    if _is_meaningful_patient_name(form_incoming_name):
                        patient_orm.name = form_incoming_name
                    elif _is_placeholder_patient_name(patient_orm.name) and _is_meaningful_patient_name(
                        merged_display_name
                    ):
                        patient_orm.name = merged_display_name

                    incoming_dob = str(payload.get("dob") or "").strip()
                    if patient_orm.date_of_birth == date(1900, 1, 1) and incoming_dob:
                        try:
                            patient_orm.date_of_birth = date.fromisoformat(incoming_dob)
                        except (TypeError, ValueError):
                            pass

                    incoming_sex = str(payload.get("sex") or "").strip().upper()[:1]
                    if patient_orm.sex in {"", "U"} and incoming_sex in {"M", "F", "O"}:
                        patient_orm.sex = incoming_sex

                study_orm = StudyORM(
                    external_id=study_ext_id,
                    description=study_description or "Hippocampus MRI Analysis",
                    volume_path=stored_volume_path,
                    modality="mri",
                    patient_id=patient_orm.id,
                    user_id=user_db_id,
                )
                session.add(study_orm)
                session.flush()

                ild_burden = float(class_metrics.get("ild_burden", 0.0) or 0.0)
                seg_orm = SegmentationResultORM(
                    external_id=f"SEG-{study_ext_id}",
                    total_ild_volume_ml=total_vol,
                    ild_fraction=ild_burden,
                    lung_volume_ml=class_metrics["lung_volume_ml"],
                    ggo_volume_ml=class_metrics["ggo_volume_ml"],
                    reticulation_volume_ml=class_metrics["reticulation_volume_ml"],
                    consolidation_volume_ml=class_metrics["consolidation_volume_ml"],
                    ggo_burden=class_metrics["ggo_burden"],
                    reticulation_burden=class_metrics["reticulation_burden"],
                    consolidation_burden=class_metrics["consolidation_burden"],
                    zonal_distribution=zonal_dist,
                    mesh_url=mesh_url or "",
                    stl_url=stl_url or "",
                    mask_path=mask_path,
                    study_id=study_orm.id,
                    dice_score=dice_score,
                    inference_architecture=arch.id,
                )
                session.add(seg_orm)
                session.flush()

                xr_orm = XRViewORM(
                    external_id=f"XR-{study_ext_id}",
                    segmentation_id=seg_orm.id,
                )
                session.add(xr_orm)
                session.commit()

                dice_out = (
                    _safe_float(dice_score, default=0.0, minimum=0.0, maximum=100.0)
                    if dice_score is not None
                    else None
                )
                xr_view = XRView(
                    id=xr_orm.external_id,
                    mesh_url=mesh_url or "",
                    stl_url=stl_url or "",
                    clipping_enabled=xr_orm.clipping_enabled,
                )
                seg_model = SegmentationResult(
                    id=seg_orm.external_id,
                    total_ild_volume_ml=_safe_float(seg_orm.total_ild_volume_ml, minimum=0.0),
                    hippocampus_volume_ml=_safe_float(seg_orm.total_ild_volume_ml, minimum=0.0),
                    left_hippocampus_ml=_safe_float(seg_orm.ggo_volume_ml, minimum=0.0)
                    if seg_orm.ggo_volume_ml is not None
                    else None,
                    right_hippocampus_ml=_safe_float(seg_orm.reticulation_volume_ml, minimum=0.0)
                    if seg_orm.reticulation_volume_ml is not None
                    else None,
                    lung_volume_ml=_safe_float(seg_orm.lung_volume_ml, minimum=0.0)
                    if seg_orm.lung_volume_ml is not None
                    else None,
                    ild_burden=_safe_float(seg_orm.ild_fraction, minimum=0.0, maximum=1.0)
                    if seg_orm.ild_fraction is not None
                    else None,
                    ggo_volume_ml=_safe_float(seg_orm.ggo_volume_ml, minimum=0.0)
                    if seg_orm.ggo_volume_ml is not None
                    else None,
                    reticulation_volume_ml=_safe_float(seg_orm.reticulation_volume_ml, minimum=0.0)
                    if seg_orm.reticulation_volume_ml is not None
                    else None,
                    consolidation_volume_ml=_safe_float(
                        seg_orm.consolidation_volume_ml, minimum=0.0
                    )
                    if seg_orm.consolidation_volume_ml is not None
                    else None,
                    ggo_burden=_safe_float(seg_orm.ggo_burden, minimum=0.0, maximum=1.0)
                    if seg_orm.ggo_burden is not None
                    else None,
                    reticulation_burden=_safe_float(
                        seg_orm.reticulation_burden, minimum=0.0, maximum=1.0
                    )
                    if seg_orm.reticulation_burden is not None
                    else None,
                    consolidation_burden=_safe_float(
                        seg_orm.consolidation_burden, minimum=0.0, maximum=1.0
                    )
                    if seg_orm.consolidation_burden is not None
                    else None,
                    zonal_distribution=_sanitize_zonal(seg_orm.zonal_distribution or {}),
                    mesh_url=seg_orm.mesh_url or "",
                    stl_url=seg_orm.stl_url or "",
                    xr_view=xr_view,
                    dice_score=dice_out,
                )
                study_model = Study(
                    id=study_orm.external_id,
                    description=study_orm.description,
                    created_at=study_orm.created_at,
                    modality=study_orm.modality,
                    segmentation=seg_model,
                )
                patient_model = Patient(
                    id=patient_orm.external_id,
                    name=patient_orm.name,
                    dateOfBirth=patient_orm.date_of_birth,
                    notes=patient_orm.notes,
                    studies=[study_model],
                )

            notify_ai_analysis_complete(
                study_id=study_ext_id,
                user_id=user_db_id,
                context="mesh",
            )

            return UploadStudyResponse(study_id=study_ext_id, patient=patient_model)
        except IntegrityError as exc:
            logger.exception(
                "Study persist conflict in %s/upload [request_id=%s]",
                log_prefix,
                request_id,
            )
            raise HTTPException(
                status_code=409,
                detail=(
                    "Could not save this study (duplicate or conflicting data). "
                    "Try another patient identifier or retry."
                ),
            ) from exc
        except ValidationError:
            logger.exception(
                "Response validation failed in %s/upload [request_id=%s]",
                log_prefix,
                request_id,
            )
            raise HTTPException(
                status_code=500,
                detail=(
                    "Analysis finished but the server could not serialize the response. "
                    f"request_id={request_id}"
                ),
            ) from None
    finally:
        try:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
        except OSError:
            logger.warning(
                "upload temp dir cleanup failed [request_id=%s] path=%s",
                request_id,
                temp_dir,
                exc_info=True,
            )
