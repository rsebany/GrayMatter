"""
Patient CRUD routes.

ORM mapping: ``common.patient_orm_to_schema``; IDs: ``services.patients.ids``.
"""

from __future__ import annotations

from .crud import router

__all__ = ["router"]
