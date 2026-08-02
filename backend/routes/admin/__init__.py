"""Admin routes — user directory (password changes stay CLI-only)."""

from __future__ import annotations

from fastapi import APIRouter

from .users import router as users_router

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(users_router)

__all__ = ["router"]
