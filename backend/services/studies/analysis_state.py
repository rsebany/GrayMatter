"""In-process mask disk path and metrics cache for study routes."""
from __future__ import annotations

from pathlib import Path

_BASE = Path(__file__).resolve().parents[2]
MASK_STORAGE = _BASE / "data" / "masks"
MASK_STORAGE.mkdir(parents=True, exist_ok=True)

_analysis_cache: dict[str, dict] = {}

__all__ = ["MASK_STORAGE", "_analysis_cache"]
