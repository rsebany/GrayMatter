"""Password reset: forgot-password token and reset-password completion."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from models.db import get_session
from models.models import PasswordResetTokenORM, UserORM
from schemas import ForgotPasswordRequest, ResetPasswordRequest
from sqlalchemy.orm import Session

from auth import create_password_reset_token, hash_password, hash_reset_token
from auth.config import RESET_TOKEN_EXPIRE_HOURS

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()

_RESET_MESSAGE = "If that email is registered, a reset link will be sent."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _reset_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)


def _find_valid_reset_record(session: Session, token: str) -> PasswordResetTokenORM | None:
    token_hash = hash_reset_token(token)
    return (
        session.query(PasswordResetTokenORM)
        .filter(
            PasswordResetTokenORM.token_hash == token_hash,
            PasswordResetTokenORM.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/forgot-password",
    summary="Request password reset",
    name="auth_forgot_password",
)
def forgot_password(body: ForgotPasswordRequest) -> dict:
    """Create a one-time reset token when the email is registered."""
    with get_session() as session:
        user = session.query(UserORM).filter(UserORM.email == body.email).first()
        if not user:
            return {"message": _RESET_MESSAGE}

        raw_token = create_password_reset_token()
        session.add(
            PasswordResetTokenORM(
                user_id=user.id,
                token_hash=hash_reset_token(raw_token),
                expires_at=_reset_expires_at(),
            )
        )

    reset_url = f"/auth/reset-password?token={raw_token}"
    return {"message": _RESET_MESSAGE, "reset_url": reset_url}


@router.post(
    "/reset-password",
    summary="Complete password reset",
    name="auth_reset_password",
)
def reset_password(body: ResetPasswordRequest) -> dict:
    """Set a new password using a valid one-time token."""
    with get_session() as session:
        rec = _find_valid_reset_record(session, body.token)
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )

        user = session.query(UserORM).filter(UserORM.id == rec.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found",
            )

        user.password_hash = hash_password(body.new_password)
        session.delete(rec)

    return {"message": "Password has been reset."}
