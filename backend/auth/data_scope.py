"""Per-user data scoping for clinical records (patients, studies)."""

from __future__ import annotations

from fastapi import HTTPException, status
from models.models import ROLE_ADMIN, PatientORM, StudyORM
from sqlalchemy.orm import Query, Session

from auth.tokens import TokenPayload


def user_id_from_token(current_user: TokenPayload) -> int:
    try:
        return int(str(current_user.sub).strip())
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session subject; please sign in again.",
        ) from exc


def is_unscoped_role(role: str) -> bool:
    """Admins may inspect all clinical records for system oversight."""
    return role == ROLE_ADMIN


def patients_query(session: Session, current_user: TokenPayload) -> Query:
    query = session.query(PatientORM)
    if is_unscoped_role(current_user.role):
        return query
    return query.filter(PatientORM.user_id == user_id_from_token(current_user))


def studies_query(session: Session, current_user: TokenPayload) -> Query:
    query = session.query(StudyORM)
    if is_unscoped_role(current_user.role):
        return query
    return query.filter(StudyORM.user_id == user_id_from_token(current_user))


def get_owned_patient_or_404(
    session: Session,
    patient_id: str,
    current_user: TokenPayload,
) -> PatientORM:
    patient = (
        patients_query(session, current_user)
        .filter(PatientORM.external_id == patient_id)
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    return patient


def get_owned_study_or_404(
    session: Session,
    study_id: str,
    current_user: TokenPayload,
) -> StudyORM:
    study = (
        studies_query(session, current_user)
        .filter(StudyORM.external_id == study_id)
        .first()
    )
    if not study:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study not found",
        )
    return study


def assert_patient_access(
    session: Session,
    patient: PatientORM,
    current_user: TokenPayload,
) -> None:
    if is_unscoped_role(current_user.role):
        return
    owner_id = user_id_from_token(current_user)
    if patient.user_id is None:
        patient.user_id = owner_id
        session.flush()
        return
    if patient.user_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this patient",
        )


__all__ = [
    "assert_patient_access",
    "get_owned_patient_or_404",
    "get_owned_study_or_404",
    "is_unscoped_role",
    "patients_query",
    "studies_query",
    "user_id_from_token",
]
