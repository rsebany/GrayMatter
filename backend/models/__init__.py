from __future__ import annotations

# ---------------------------------------------------------------------------
# ORM entities & role constants
# ---------------------------------------------------------------------------

from models.models import (
    ROLE_ADMIN,
    ROLE_RADIOLOGIST,
    ROLE_REFERRING,
    Base,
    NotificationORM,
    PasswordResetTokenORM,
    PatientORM,
    SegmentationResultORM,
    SettingsORM,
    StudyORM,
    UserORM,
    XRViewORM,
    utcnow,
)

# ---------------------------------------------------------------------------
# Database access
# ---------------------------------------------------------------------------

from models.db import get_session, init_db

# ---------------------------------------------------------------------------
# Public surface
# ---------------------------------------------------------------------------

__all__ = [
    # roles / base
    "ROLE_ADMIN",
    "ROLE_RADIOLOGIST",
    "ROLE_REFERRING",
    "Base",
    "utcnow",
    # core
    "UserORM",
    "PatientORM",
    "StudyORM",
    # AI / XR
    "SegmentationResultORM",
    "XRViewORM",
    # infrastructure
    "SettingsORM",
    "NotificationORM",
    "PasswordResetTokenORM",
    # db
    "get_session",
    "init_db",
]
