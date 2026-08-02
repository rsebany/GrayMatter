"""Practitioner identifier generation."""

from __future__ import annotations

import uuid


def _generate_medical_id() -> str:
    """Unique medical ID for practitioners: ``ILD-2026-XXXXXXXX``."""
    suffix = uuid.uuid4().hex[:8].upper()
    return f"ILD-2026-{suffix}"


__all__ = ["_generate_medical_id"]
