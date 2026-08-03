"""JWT access tokens and opaque password-reset tokens."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from models.models import ROLE_RADIOLOGIST
from pydantic import BaseModel

from auth.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY

# ---------------------------------------------------------------------------
# Access tokens (JWT)
# ---------------------------------------------------------------------------


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


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


def get_token_payload(
    credentials: HTTPAuthorizationCredentials | None,
) -> TokenPayload | None:
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    if not payload:
        return None
    return TokenPayload(
        sub=payload.get("sub", ""),
        email=payload.get("email", ""),
        role=payload.get("role", ROLE_RADIOLOGIST),
        medical_id=payload.get("medical_id", ""),
        full_name=payload.get("full_name", ""),
    )


__all__ = [
    "TokenPayload",
    "create_access_token",
    "create_password_reset_token",
    "decode_token",
    "get_token_payload",
    "hash_reset_token",
    "verify_reset_token",
]
