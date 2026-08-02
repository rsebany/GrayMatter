"""
Slicer/bridge sync under ``/studies/.../segmentation-*`` plus per-study SSE.
"""

from __future__ import annotations

from fastapi import APIRouter

from . import endpoints

router = APIRouter(prefix="/studies", tags=["segmentation-sync"])
router.include_router(endpoints.router)

__all__ = ["router"]