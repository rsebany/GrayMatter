"""External patient IDs used by API + ORM (distinct from user medical_id in `auth/`)."""
from __future__ import annotations

import uuid


def generate_patient_external_id() -> str:
    """Format ``ILD-2026-XXXXXXXX`` (upper hex suffix)."""
    suffix = uuid.uuid4().hex[:8].upper()
    return f"ILD-2026-{suffix}"


__all__ = ["generate_patient_external_id"]
