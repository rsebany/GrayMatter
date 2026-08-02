"""Slicer/bridge sync: study volume load, revision URLs, manifest mapping."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.models import StudyORM
from routes.studies.common import StudyVolume, _load_study_volume
from schemas import SegmentationRevisionCreate, SegmentationRevisionInfo
from services.core.paths import DICOM_STORAGE
from services.sync.segmentation import LABEL_CONTRACT

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_REQUIRED_LABELS = frozenset({"background", "left", "right"})
_SPACING_TOLERANCE_MM = 0.2
_SUPPORTED_ORIENTATION = "zyx"


# ---------------------------------------------------------------------------
# Time & paths
# ---------------------------------------------------------------------------


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_mask_url(study_id: str, revision_id: int) -> str:
    return f"/studies/{study_id}/segmentation-revisions/{revision_id}/mask"


def study_dicom_dir(study_id: str) -> Path:
    path = DICOM_STORAGE / study_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Study DICOM directory not found.")
    return path


# ---------------------------------------------------------------------------
# Study volume (DICOM or NIfTI)
# ---------------------------------------------------------------------------


def load_study_volume_and_spacing(study_id: str) -> StudyVolume:
    """Load native study volume + spacing (DICOM series or NIfTI)."""
    return _load_study_volume(study_id)


def load_dicom_volume_and_spacing(study_id: str) -> tuple[np.ndarray, tuple[float, float, float]]:
    """Legacy helper — prefer ``load_study_volume_and_spacing``."""
    vol = load_study_volume_and_spacing(study_id)
    return vol.data, vol.spacing_zyx


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------


def as_revision_info(study_id: str, item: dict[str, Any]) -> SegmentationRevisionInfo:
    return SegmentationRevisionInfo(
        revision_id=int(item["revision_id"]),
        source=str(item["source"]),
        revision_note=item.get("revision_note"),
        created_at=datetime.fromisoformat(item["created_at"]),
        geometry=item["geometry"],
        labels=item.get("labels") or LABEL_CONTRACT,
        mask_url=to_mask_url(study_id, int(item["revision_id"])),
        mesh_url=item.get("mesh_url"),
    )


# ---------------------------------------------------------------------------
# Revision validation
# ---------------------------------------------------------------------------


def require_study(session: Session, study_id: str) -> StudyORM:
    study = session.query(StudyORM).filter(StudyORM.external_id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Unknown study_id.")
    return study


def parse_revision_geometry(
    payload: SegmentationRevisionCreate,
) -> tuple[tuple[int, int, int], tuple[float, float, float], str]:
    shape_zyx = tuple(int(v) for v in payload.geometry.shape_zyx)
    spacing_zyx_mm = tuple(float(v) for v in payload.geometry.spacing_zyx_mm)
    orientation = payload.geometry.orientation.lower().strip()
    if orientation != _SUPPORTED_ORIENTATION:
        raise HTTPException(
            status_code=422,
            detail=f"Only '{_SUPPORTED_ORIENTATION}' orientation is currently supported.",
        )
    return shape_zyx, spacing_zyx_mm, orientation


def validate_mask_shape_matches_volume(
    shape_zyx: tuple[int, int, int],
    volume: np.ndarray,
) -> None:
    if shape_zyx != tuple(int(v) for v in volume.shape):
        raise HTTPException(
            status_code=422,
            detail=f"Mask shape {shape_zyx} does not match study volume shape {tuple(volume.shape)}.",
        )


def validate_mask_shape_matches_dicom(
    shape_zyx: tuple[int, int, int],
    volume_hu: np.ndarray,
) -> None:
    validate_mask_shape_matches_volume(shape_zyx, volume_hu)


def validate_spacing_matches_volume(
    spacing_zyx_mm: tuple[float, float, float],
    study_spacing: tuple[float, float, float],
) -> None:
    for requested, actual in zip(spacing_zyx_mm, study_spacing):
        if abs(requested - actual) > _SPACING_TOLERANCE_MM:
            raise HTTPException(
                status_code=422,
                detail=f"Spacing mismatch. Received {spacing_zyx_mm}, expected approx {study_spacing}.",
            )


def validate_spacing_matches_dicom(
    spacing_zyx_mm: tuple[float, float, float],
    dicom_spacing: tuple[float, float, float],
) -> None:
    validate_spacing_matches_volume(spacing_zyx_mm, dicom_spacing)


def validate_revision_labels(labels: dict) -> dict:
    if set(labels.keys()) != _REQUIRED_LABELS:
        raise HTTPException(
            status_code=422,
            detail=f"labels must contain exactly {sorted(_REQUIRED_LABELS)}.",
        )
    return dict(labels)


def assert_mask_changed(
    manifest: dict[str, Any],
    mask: np.ndarray,
) -> None:
    revisions = manifest.get("revisions", [])
    if not revisions:
        return
    latest = revisions[-1]
    if not latest.get("mask_path"):
        return
    latest_mask_path = Path(str(latest["mask_path"]))
    if not latest_mask_path.exists():
        return
    previous = np.load(latest_mask_path).astype(np.uint8)
    if previous.shape == mask.shape and np.array_equal(previous, mask):
        raise HTTPException(status_code=409, detail="Revision ignored: mask content is unchanged.")