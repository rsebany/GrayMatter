"""Bcrypt password hashing and verification."""

from __future__ import annotations

from fastapi import HTTPException, status
from passlib.context import CryptContext

# ---------------------------------------------------------------------------
# Context
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_BCRYPT_MAX_BYTES = 72


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize_password(plain: str) -> str:
    """Enforce bcrypt length limit; raise 400 instead of an opaque 500."""
    if len(plain.encode("utf-8")) > _BCRYPT_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is too long. Maximum length is 72 characters.",
        )
    return plain


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_normalize_password(plain), hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(_normalize_password(plain))


__all__ = ["hash_password", "verify_password"]
