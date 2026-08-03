"""Shared study-route helpers: DICOM paths, volume load, CT windowing."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import numpy as np
from fastapi import HTTPException, status
from models.db import get_session
from models.models import StudyORM
from scipy.ndimage import gaussian_filter
from services.ai.mri_pipeline import NiftiInputError
from services.core.paths import (
    BACKEND_AI_ROOT,
    BASE_DIR,
    DICOM_STORAGE,
    NIFTI_STORAGE,
    STATIC_MESH_DIR,
    WEIGHTS_PATH,
)
from services.dicom.series_read import (
    list_dicom_paths,
    read_sorted_dicom_slices,
    spacing_zyx_mm,
    stack_pixel_volume_zyx_viewer,
)
from services.volumes.nifti_volume import is_nifti_path, load_nifti_preview_volume

# Re-export path constants for route modules.
__all__ = [
    "BACKEND_AI_ROOT",
    "BASE_DIR",
    "DICOM_STORAGE",
    "NIFTI_STORAGE",
    "STATIC_MESH_DIR",
    "WEIGHTS_PATH",
    "StudyVolume",
    "_clear_study_volume_cache",
    "_ct_hu_plane_to_lung_window_rgb",
    "_dicom_series_spacing_mm",
    "_ensure_study_dicom_dir",
    "_legacy_patient_json",
    "_load_dicom_volume_and_slices",
    "_load_study_volume",
    "_plane_to_display_rgb",
    "_resolve_study_nifti_path",
    "_study_has_dicom_series",
]

# ---------------------------------------------------------------------------
# CT windowing (2D viewer)
# ---------------------------------------------------------------------------


def _ct_hu_plane_to_lung_window_rgb(
    ct_slice_3d: np.ndarray,
    window_center: int,
    window_width: int,
    denoise: bool,
) -> np.ndarray:
    """Grayscale RGB for one HU frame: DICOM window + optional blur."""
    lower = float(window_center) - float(window_width) / 2.0
    upper = float(window_center) + float(window_width) / 2.0
    ct_slice = np.clip(ct_slice_3d, lower, upper)
    ct_slice = (ct_slice - lower) / (upper - lower) if upper != lower else np.zeros_like(ct_slice)
    if denoise:
        ct_slice = gaussian_filter(ct_slice, sigma=0.8)
    gray = np.clip(ct_slice * 255.0, 0, 255).astype(np.uint8)
    return np.stack([gray, gray, gray], axis=-1)


def _mri_preview_plane_to_rgb(
    mri_slice: np.ndarray,
    window_center: int,
    window_width: int,
    denoise: bool,
) -> np.ndarray:
    """Grayscale RGB for MONAI preview MRI (0–1) with 0–255 window/level."""
    arr = np.asarray(mri_slice, dtype=np.float32)
    if arr.size == 0:
        return np.zeros((1, 1, 3), dtype=np.uint8)

    lo, hi = np.percentile(arr, [0.5, 99.5])
    if hi <= lo:
        lo = float(arr.min())
        hi = float(arr.max())
    if hi > lo:
        arr = (arr - lo) / (hi - lo)
    arr = np.clip(arr, 0.0, 1.0)

    center = float(window_center)
    half = float(window_width) / 2.0
    lower = (center - half) / 255.0
    upper = (center + half) / 255.0
    if upper > lower:
        arr = np.clip(arr, lower, upper)
        arr = (arr - lower) / (upper - lower)
    else:
        arr = np.zeros_like(arr)

    if denoise:
        arr = gaussian_filter(arr, sigma=0.8)
    gray = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    return np.stack([gray, gray, gray], axis=-1)


def _plane_to_display_rgb(
    plane: np.ndarray,
    *,
    window_center: int,
    window_width: int,
    denoise: bool,
    is_hu: bool,
) -> np.ndarray:
    del is_hu
    return _mri_preview_plane_to_rgb(plane, window_center, window_width, denoise)


# ---------------------------------------------------------------------------
# Study volume (DICOM dir or NIfTI file)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class StudyVolume:
    data: np.ndarray
    spacing_zyx: tuple[float, float, float]
    source: Literal["dicom", "nifti"]
    is_hu: bool


_volume_cache: dict[str, StudyVolume] = {}


def _study_has_dicom_series(study_dicom_dir: Path) -> bool:
    return study_dicom_dir.is_dir() and bool(list_dicom_paths(study_dicom_dir, include_dicom_ext=True))


def _resolve_study_nifti_path(study_id: str) -> Path | None:
    with get_session() as session:
        study = session.query(StudyORM).filter(StudyORM.external_id == study_id).first()
        if not study or not study.volume_path:
            return None
        path = Path(study.volume_path)
    if path.is_file() and is_nifti_path(path):
        return path
    return None


def _load_study_volume(study_id: str) -> StudyVolume:
    cached = _volume_cache.get(study_id)
    if cached is not None:
        return cached

    study_dicom_dir = DICOM_STORAGE / study_id
    if _study_has_dicom_series(study_dicom_dir):
        try:
            volume, slices = _load_dicom_volume_and_slices(study_dicom_dir)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        slope = float(getattr(slices[0], "RescaleSlope", 1.0))
        intercept = float(getattr(slices[0], "RescaleIntercept", 0.0))
        vol_hu = volume * slope + intercept
        spacing = _dicom_series_spacing_mm(slices)
        loaded = StudyVolume(
            data=vol_hu.astype(np.float32, copy=False),
            spacing_zyx=spacing,
            source="dicom",
            is_hu=True,
        )
        _volume_cache[study_id] = loaded
        return loaded

    nifti_path = _resolve_study_nifti_path(study_id)
    if nifti_path and nifti_path.exists():
        try:
            volume, spacing = load_nifti_preview_volume(nifti_path, BACKEND_AI_ROOT)
        except NiftiInputError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        loaded = StudyVolume(
            data=volume,
            spacing_zyx=spacing,
            source="nifti",
            is_hu=False,
        )
        _volume_cache[study_id] = loaded
        return loaded

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Imaging volume not found on disk",
    )


def _clear_study_volume_cache(study_id: str) -> None:
    _volume_cache.pop(study_id, None)


# ---------------------------------------------------------------------------
# DICOM on disk
# ---------------------------------------------------------------------------


def _ensure_study_dicom_dir(study_id: str) -> Path:
    """Return stored DICOM series dir; backfill from ``volume_path`` when it is a directory."""
    study_dicom_dir = DICOM_STORAGE / study_id
    if study_dicom_dir.exists():
        return study_dicom_dir

    with get_session() as session:
        study = session.query(StudyORM).filter(StudyORM.external_id == study_id).first()
        volume_path = Path(study.volume_path) if study and study.volume_path else None
        if volume_path and volume_path.is_dir() and volume_path.exists():
            try:
                study_dicom_dir.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(volume_path, study_dicom_dir, dirs_exist_ok=True)
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to reconstruct DICOM data from volume_path: {exc}",
                ) from exc
    return study_dicom_dir


def _load_dicom_volume_and_slices(study_dicom_dir: Path) -> tuple[np.ndarray, list[Any]]:
    """Stack sorted DICOM into (Z, Y, X) volume + pydicom datasets for HU metadata."""
    slices = read_sorted_dicom_slices(study_dicom_dir)
    if not slices:
        raise ValueError("Study directory contains no DICOM files")
    for s in slices:
        if len(s.pixel_array.shape) == 3:
            print(
                f"[DICOM Debug] Multi-frame detected: {s.pixel_array.shape[0]} frames, using only first frame"
            )
            break
    volume = stack_pixel_volume_zyx_viewer(slices)
    return volume, slices


def _dicom_series_spacing_mm(slices: list[Any]) -> tuple[float, float, float]:
    """Spacing mm (z, y, x) matching (D, H, W) volume order."""
    return spacing_zyx_mm(slices, mode="viewer")


# ---------------------------------------------------------------------------
# Upload form helpers
# ---------------------------------------------------------------------------


def _legacy_patient_json(
    *,
    patient_id: str | None,
    patient_name: str | None,
    date_of_birth: str | None,
    clinical_notes: str | None,
) -> str:
    resolved_name = (patient_name or "").strip()
    resolved_id = (patient_id or "").strip()
    if not resolved_name:
        resolved_name = resolved_id or "Unknown Patient"

    payload: dict[str, Any] = {
        "name": resolved_name,
        "dob": date_of_birth,
        "sex": "U",
        "notes": clinical_notes,
    }
    if resolved_id and resolved_id != "patient-unknown":
        payload["id"] = resolved_id
    return json.dumps(payload)
