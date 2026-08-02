"""
Authentication HTTP routes.

- ``session_routes`` — login, signup, ``/me``
- ``password_routes`` — forgot / reset password
"""

from __future__ import annotations

from fastapi import APIRouter

from . import password_routes, session_routes

router = APIRouter(prefix="/auth", tags=["auth"])
router.include_router(session_routes.router)
router.include_router(password_routes.router)

__all__ = ["router"]
