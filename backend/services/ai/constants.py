"""Shared label map and pipeline exceptions for AI services."""
from __future__ import annotations

# 0=background, 1=left hippocampus, 2=right hippocampus
CLASS_LABELS: dict[int, str] = {1: "left", 2: "right"}

# Legacy API field aliases (DB columns still use ggo_/reticulation_ names).
LEGACY_VOLUME_KEYS = {
    "left": "ggo_volume_ml",
    "right": "reticulation_volume_ml",
}


class DicomInputError(ValueError):
    """Raised when uploaded imaging data is invalid for processing."""


__all__ = ["CLASS_LABELS", "LEGACY_VOLUME_KEYS", "DicomInputError"]
