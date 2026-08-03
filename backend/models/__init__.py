from __future__ import annotations

# ---------------------------------------------------------------------------
# Database access
# ---------------------------------------------------------------------------
from models.db import get_session, init_db

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
# Public surface
# ---------------------------------------------------------------------------

__all__ = [
    # roles / base
    "ROLE_ADMIN",
    "ROLE_RADIOLOGIST",
    "ROLE_REFERRING",
    "Base",
    "NotificationORM",
    "PasswordResetTokenORM",
    "PatientORM",
    # AI / XR
    "SegmentationResultORM",
    # infrastructure
    "SettingsORM",
    "StudyORM",
    # core
    "UserORM",
    "XRViewORM",
    # db
    "get_session",
    "init_db",
    "utcnow",
]
