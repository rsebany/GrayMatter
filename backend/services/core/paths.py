"""Single source for backend data paths (DICOM, meshes, sync storage, weights)."""

from __future__ import annotations

from pathlib import Path

from config import (
    BACKEND_AI_ROOT,
    MRI_SAMPLES_DIR,
    UPLOAD_STORAGE,
    WEIGHTS_PATH,
    WORKER_SCRIPT,
)

BASE_DIR = Path(__file__).resolve().parents[2]
DICOM_STORAGE = BASE_DIR / "data" / "dicom"
NIFTI_STORAGE = UPLOAD_STORAGE
STATIC_MESH_DIR = BASE_DIR / "static" / "meshes"
SYNC_STORAGE = BASE_DIR / "data" / "segmentation_revisions"

__all__ = [
    "BACKEND_AI_ROOT",
    "BASE_DIR",
    "DICOM_STORAGE",
    "MRI_SAMPLES_DIR",
    "NIFTI_STORAGE",
    "STATIC_MESH_DIR",
    "SYNC_STORAGE",
    "UPLOAD_STORAGE",
    "WEIGHTS_PATH",
    "WORKER_SCRIPT",
]
