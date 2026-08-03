"""Shared auth route helpers: JWT claims and user response mapping."""

from __future__ import annotations

from models.models import ROLE_RADIOLOGIST, UserORM
from schemas import UserResponse

from auth.config import RESET_TOKEN_EXPIRE_HOURS

# ---------------------------------------------------------------------------
# Mappers
# ---------------------------------------------------------------------------


def user_to_response(u: UserORM) -> UserResponse:
    return UserResponse(
        id=u.id,
        medical_id=u.medical_id,
        full_name=u.full_name,
        email=u.email,
        role=u.role or ROLE_RADIOLOGIST,
    )


def token_data(u: UserORM) -> dict:
    return {
        "sub": str(u.id),
        "email": u.email,
        "role": u.role or ROLE_RADIOLOGIST,
        "medical_id": u.medical_id,
        "full_name": u.full_name,
    }


__all__ = ["RESET_TOKEN_EXPIRE_HOURS", "token_data", "user_to_response"]
