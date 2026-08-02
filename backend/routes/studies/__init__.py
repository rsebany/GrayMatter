"""
Study HTTP routes (prefix ``/studies`` on each sub-router).

Modules: upload, list/metrics, DICOM export, mask/mesh outputs, slice viewer.
"""

from __future__ import annotations

from fastapi import APIRouter

from . import dicom_export, list_and_metrics, outputs, slice_viewer, upload_routes

router = APIRouter()
for _mod in (
    upload_routes,
    list_and_metrics,
    dicom_export,
    outputs,
    slice_viewer,
):
    router.include_router(_mod.router)

__all__ = ["router"]
