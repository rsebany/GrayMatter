"""Patient CRUD HTTP routes."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from auth import (
    TokenPayload,
    get_current_user,
    get_owned_patient_or_404,
    is_unscoped_role,
    patients_query,
    user_id_from_token,
)
from fastapi import APIRouter, Depends
from models.db import get_session
from models.models import PatientORM
from schemas import Patient, PatientCreate, PatientUpdate
from services.patients.ids import generate_patient_external_id
from sqlalchemy.orm import Session

from .common import patient_orm_to_schema

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/patients", tags=["patients"])

_DEFAULT_DOB = date(1900, 1, 1)


def _owner_filter_id(current_user: TokenPayload) -> int | None:
    if is_unscoped_role(current_user.role):
        return None
    return user_id_from_token(current_user)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _allocate_external_id(session: Session) -> str:
    while True:
        medical_id = generate_patient_external_id()
        exists = (
            session.query(PatientORM)
            .filter(PatientORM.external_id == medical_id)
            .first()
        )
        if not exists:
            return medical_id


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=list[Patient],
    summary="List patients for the current user",
    name="patients_list",
)
async def list_patients(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> list[Patient]:
    with get_session() as session:
        patients = (
            patients_query(session, current_user)
            .order_by(PatientORM.id.desc())
            .all()
        )
        return [
            patient_orm_to_schema(p, owner_user_id=_owner_filter_id(current_user))
            for p in patients
        ]


@router.get(
    "/{patient_id}",
    response_model=Patient,
    summary="Get one patient",
    name="patients_get",
)
async def get_patient(
    patient_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> Patient:
    with get_session() as session:
        return patient_orm_to_schema(
            get_owned_patient_or_404(session, patient_id, current_user),
            owner_user_id=_owner_filter_id(current_user),
        )


@router.post(
    "",
    response_model=Patient,
    status_code=201,
    summary="Create patient",
    name="patients_create",
)
async def create_patient(
    payload: PatientCreate,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> Patient:
    with get_session() as session:
        patient = PatientORM(
            external_id=_allocate_external_id(session),
            name=payload.name,
            date_of_birth=payload.dateOfBirth or _DEFAULT_DOB,
            sex=(payload.sex or "U").strip().upper()[:1] or "U",
            notes=payload.notes,
            user_id=user_id_from_token(current_user),
        )
        session.add(patient)
        session.flush()
        return patient_orm_to_schema(patient, owner_user_id=_owner_filter_id(current_user))


@router.put(
    "/{patient_id}",
    response_model=Patient,
    summary="Update patient",
    name="patients_update",
)
async def update_patient(
    patient_id: str,
    payload: PatientUpdate,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> Patient:
    with get_session() as session:
        patient = get_owned_patient_or_404(session, patient_id, current_user)

        if payload.name is not None:
            patient.name = payload.name
        if payload.dateOfBirth is not None:
            patient.date_of_birth = payload.dateOfBirth
        if payload.notes is not None:
            patient.notes = payload.notes

        session.flush()
        return patient_orm_to_schema(patient, owner_user_id=_owner_filter_id(current_user))


@router.delete(
    "/{patient_id}",
    status_code=204,
    summary="Delete patient",
    name="patients_delete",
)
async def delete_patient(
    patient_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> None:
    with get_session() as session:
        session.delete(get_owned_patient_or_404(session, patient_id, current_user))
