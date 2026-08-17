"""JWT access tokens and opaque password-reset tokens."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from models.models import ROLE_RADIOLOGIST
from pydantic import BaseModel, ValidationError

from auth.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
    SLICER_TOKEN_EXPIRE_MINUTES,
)

# ---------------------------------------------------------------------------
# Access tokens (JWT)
# ---------------------------------------------------------------------------


def create_access_token(data: dict, *, expires_minutes: int | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "token_type": to_encode.get("token_type", "access")})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_slicer_integration_token(data: dict, study_id: str) -> tuple[str, datetime]:
    """Issue a short-lived token restricted to one study revision-write capability."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=SLICER_TOKEN_EXPIRE_MINUTES)
    claims = data.copy()
    claims.update(
        {
            "exp": expire,
            "token_type": "slicer_integration",
            "scope": "segmentation:write",
            "study_id": study_id,
        }
    )
    return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM), expire


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# Password-reset tokens (opaque)
# ---------------------------------------------------------------------------


def create_password_reset_token() -> str:
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def verify_reset_token(token: str, token_hash: str) -> bool:
    return secrets.compare_digest(hash_reset_token(token), token_hash)


# ---------------------------------------------------------------------------
# Request payload
# ---------------------------------------------------------------------------


class TokenPayload(BaseModel):
    sub: str
    email: str
    role: str
    medical_id: str
    full_name: str
    token_type: str = "access"
    scope: str | None = None
    study_id: str | None = None


def get_token_payload(
    credentials: HTTPAuthorizationCredentials | None,
) -> TokenPayload | None:
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    if not payload:
        return None
    return token_payload_from_claims(payload)


def token_payload_from_claims(payload: dict) -> TokenPayload | None:
    if not payload.get("sub") or not payload.get("email"):
        return None
    if payload.get("token_type", "access") not in {"access", "slicer_integration"}:
        return None
    try:
        return TokenPayload(
            sub=payload["sub"],
            email=payload["email"],
            role=payload.get("role", ROLE_RADIOLOGIST),
            medical_id=payload.get("medical_id", ""),
            full_name=payload.get("full_name", ""),
            token_type=payload.get("token_type", "access"),
            scope=payload.get("scope"),
            study_id=payload.get("study_id"),
        )
    except ValidationError:
        return None


__all__ = [
    "TokenPayload",
    "create_access_token",
    "create_password_reset_token",
    "create_slicer_integration_token",
    "decode_token",
    "get_token_payload",
    "hash_reset_token",
    "token_payload_from_claims",
    "verify_reset_token",
]
