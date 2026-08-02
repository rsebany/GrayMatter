"""Patient registry helpers (external IDs distinct from auth medical_id)."""
from __future__ import annotations

from services.patients.ids import generate_patient_external_id

__all__ = ["generate_patient_external_id"]
