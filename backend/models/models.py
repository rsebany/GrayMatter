from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# ---------------------------------------------------------------------------
# Role constants (shared with auth.roles)
# ---------------------------------------------------------------------------

ROLE_RADIOLOGIST = "radiologist"
ROLE_REFERRING = "referring_physician"
ROLE_ADMIN = "admin"


# ---------------------------------------------------------------------------
# Base & helpers
# ---------------------------------------------------------------------------


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp for ORM defaults."""
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Core entities
# ---------------------------------------------------------------------------


class UserORM(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    medical_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default=ROLE_RADIOLOGIST)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    settings: Mapped[SettingsORM | None] = relationship(
        "SettingsORM", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    notifications: Mapped[list[NotificationORM]] = relationship(
        "NotificationORM", back_populates="user", cascade="all, delete-orphan"
    )
    studies: Mapped[list[StudyORM]] = relationship("StudyORM", back_populates="user")
    patients: Mapped[list[PatientORM]] = relationship(
        "PatientORM", back_populates="user"
    )


class PatientORM(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    sex: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    user: Mapped[UserORM | None] = relationship("UserORM", back_populates="patients")
    studies: Mapped[list[StudyORM]] = relationship(
        "StudyORM", back_populates="patient", cascade="all, delete-orphan"
    )


class StudyORM(Base):
    __tablename__ = "studies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    study_uid: Mapped[str | None] = mapped_column(String, nullable=True)
    modality: Mapped[str] = mapped_column(String, default="mri")
    volume_path: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    patient: Mapped[PatientORM] = relationship("PatientORM", back_populates="studies")
    user: Mapped[UserORM] = relationship("UserORM", back_populates="studies")
    segmentation: Mapped[SegmentationResultORM | None] = relationship(
        "SegmentationResultORM",
        back_populates="study",
        uselist=False,
        cascade="all, delete-orphan",
    )


# ---------------------------------------------------------------------------
# AI segmentation & metrics
# ---------------------------------------------------------------------------


class SegmentationResultORM(Base):
    __tablename__ = "segmentations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, index=True)

    total_ild_volume_ml: Mapped[float] = mapped_column(Float)
    ild_fraction: Mapped[float] = mapped_column(Float, default=0.0)
    lung_volume_ml: Mapped[float | None] = mapped_column(Float, nullable=True)

    ggo_volume_ml: Mapped[float | None] = mapped_column(Float, nullable=True)
    reticulation_volume_ml: Mapped[float | None] = mapped_column(Float, nullable=True)
    consolidation_volume_ml: Mapped[float | None] = mapped_column(Float, nullable=True)

    ggo_burden: Mapped[float | None] = mapped_column(Float, nullable=True)
    reticulation_burden: Mapped[float | None] = mapped_column(Float, nullable=True)
    consolidation_burden: Mapped[float | None] = mapped_column(Float, nullable=True)

    dice_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    inference_architecture: Mapped[str | None] = mapped_column(String, nullable=True)
    zonal_distribution: Mapped[dict] = mapped_column(JSON)
    visualization_mode: Mapped[str] = mapped_column(String, default="mixed")

    mesh_url: Mapped[str] = mapped_column(String)
    stl_url: Mapped[str] = mapped_column(String, default="")
    mask_shape: Mapped[str | None] = mapped_column(String, nullable=True)
    mask_bytes: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    mask_path: Mapped[str | None] = mapped_column(String, nullable=True)

    study_id: Mapped[int] = mapped_column(ForeignKey("studies.id"), unique=True)

    study: Mapped[StudyORM] = relationship("StudyORM", back_populates="segmentation")
    xr_view: Mapped[XRViewORM | None] = relationship(
        "XRViewORM",
        back_populates="segmentation",
        uselist=False,
        cascade="all, delete-orphan",
    )


# ---------------------------------------------------------------------------
# XR viewer
# ---------------------------------------------------------------------------


class XRViewORM(Base):
    __tablename__ = "xr_views"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    clipping_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    segmentation_id: Mapped[int] = mapped_column(ForeignKey("segmentations.id"), unique=True)

    segmentation: Mapped[SegmentationResultORM] = relationship(
        "SegmentationResultORM", back_populates="xr_view"
    )


# ---------------------------------------------------------------------------
# Settings, notifications, auth tokens
# ---------------------------------------------------------------------------


class SettingsORM(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)

    email_on_analysis: Mapped[bool] = mapped_column(Boolean, default=True)
    in_app_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    default_view: Mapped[str] = mapped_column(String, default="2d")
    # Segmentation display unit: mm (mm³), cm (cm³), ml, or percent (lung burden).
    unit_measurement: Mapped[str] = mapped_column(String, default="mm")

    pacs_api_key: Mapped[str | None] = mapped_column(String, nullable=True)
    pacs_endpoint: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[UserORM] = relationship("UserORM", back_populates="settings")


class NotificationORM(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(String, default="")
    type: Mapped[str] = mapped_column(String, default="info")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[UserORM] = relationship("UserORM", back_populates="notifications")


class PasswordResetTokenORM(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


__all__ = [
    "ROLE_ADMIN",
    "ROLE_RADIOLOGIST",
    "ROLE_REFERRING",
    "Base",
    "NotificationORM",
    "PasswordResetTokenORM",
    "PatientORM",
    "SegmentationResultORM",
    "SettingsORM",
    "StudyORM",
    "UserORM",
    "XRViewORM",
    "utcnow",
]
