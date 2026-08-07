"""Pydantic request/response models shared by routes and services."""
from __future__ import annotations

from datetime import date, datetime
import math
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    role: Literal["radiologist", "referring_physician"] = "radiologist"
    password: str = Field(..., min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=72)


class UserResponse(BaseModel):
    id: int
    medical_id: str
    full_name: str
    email: EmailStr
    role: str


class AdminUserListItem(BaseModel):
    """Practitioner row for the admin dashboard (no secrets)."""

    id: int
    medical_id: str
    full_name: str
    email: EmailStr
    role: str
    created_at: datetime


class AdminCreateUserRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    role: str
    password: str = Field(..., min_length=8, max_length=72)


class AdminUpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    role: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SlicerTokenRequest(BaseModel):
    study_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$",
    )


class SlicerTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    scope: Literal["segmentation:write"] = "segmentation:write"
    study_id: str
    expires_at: datetime


# ---------------------------------------------------------------------------
# Patients & nested studies (API domain)
# ---------------------------------------------------------------------------


class XRView(BaseModel):
    id: str
    mesh_url: str
    stl_url: str = ""
    clipping_enabled: bool = True


class SegmentationResult(BaseModel):
    id: str
    total_ild_volume_ml: float = Field(..., ge=0)
    lung_volume_ml: float | None = Field(default=None, ge=0)
    ild_burden: float | None = Field(default=None, ge=0, le=1)
    ggo_volume_ml: float | None = Field(default=None, ge=0)
    reticulation_volume_ml: float | None = Field(default=None, ge=0)
    consolidation_volume_ml: float | None = Field(default=None, ge=0)
    ggo_burden: float | None = Field(default=None, ge=0, le=1)
    reticulation_burden: float | None = Field(default=None, ge=0, le=1)
    consolidation_burden: float | None = Field(default=None, ge=0, le=1)
    hippocampus_volume_ml: float | None = Field(default=None, ge=0)
    left_hippocampus_ml: float | None = Field(default=None, ge=0)
    right_hippocampus_ml: float | None = Field(default=None, ge=0)
    zonal_distribution: dict[str, float] = Field(default_factory=dict)
    mesh_url: str
    stl_url: str = ""
    xr_view: XRView | None = None
    visualization_mode: Literal["2d", "3d", "xr", "mixed"] = "mixed"
    dice_score: float | None = Field(None, ge=0, le=100)


class Study(BaseModel):
    id: str
    description: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    modality: str = "mri"
    segmentation: SegmentationResult | None = None


class Patient(BaseModel):
    id: str
    name: str
    dateOfBirth: date | None = None
    notes: str | None = None
    studies: list[Study] = []


class PatientCreate(BaseModel):
    name: str
    dateOfBirth: date | None = None
    notes: str | None = None
    sex: str | None = None


class PatientUpdate(BaseModel):
    name: str | None = None
    dateOfBirth: date | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Study list, upload, metrics
# ---------------------------------------------------------------------------


class StudyListItem(BaseModel):
    study_id: str
    patient_id: str
    patient_name: str
    modality: str
    ild_fraction: float
    volume_total_mm3: float
    status: Literal["Completed", "Processing", "Pending"]
    acquisition_date: datetime | None = None
    zonal_distribution: dict[str, float] = Field(default_factory=dict)
    lung_volume_ml: float | None = None
    ggo_volume_ml: float | None = None
    reticulation_volume_ml: float | None = None
    consolidation_volume_ml: float | None = None
    ggo_burden: float | None = None
    reticulation_burden: float | None = None
    consolidation_burden: float | None = None


class UploadStudyResponse(BaseModel):
    """``POST /studies/upload`` (DICOM ZIP/folder or NIfTI)."""

    study_id: str
    patient: Patient


class StudyMetrics(BaseModel):
    """``GET /studies/{study_id}/metrics``."""

    study_id: str
    volume_total_mm3: float
    ild_fraction: float
    hippocampus_volume_ml: float | None = Field(default=None, ge=0)
    left_hippocampus_ml: float | None = Field(default=None, ge=0)
    right_hippocampus_ml: float | None = Field(default=None, ge=0)
    zonal_distribution: dict[str, float] = Field(default_factory=dict)
    lung_volume_ml: float | None = None
    ggo_volume_ml: float | None = None
    reticulation_volume_ml: float | None = None
    consolidation_volume_ml: float | None = None
    ggo_burden: float | None = None
    reticulation_burden: float | None = None
    consolidation_burden: float | None = None
    ild_burden: float | None = None
    architecture_id: str | None = None
    architecture_label: str | None = None


class ArchitectureOption(BaseModel):
    """``GET /studies/architectures``."""

    id: str
    label: str
    builder: str
    best_val_dice: float | None = Field(default=None, ge=0, le=1)
    is_default: bool = False
    available: bool = True


# ---------------------------------------------------------------------------
# Expert mask compare
# ---------------------------------------------------------------------------


class ExpertMaskCompareResponse(BaseModel):
    """``POST /studies/upload/expert-mask-compare``."""

    study_id: str
    expert_shape: list[int] = Field(..., min_length=3, max_length=3)
    prediction_shape: list[int] = Field(..., min_length=3, max_length=3)
    dice: dict[str, float] = Field(default_factory=dict)
    expert_label_max_seen: int = Field(..., ge=0)
    expert_labels_were_clipped: bool = False
    expert_remap_mode: str = "unknown"
    expert_remap_note: str | None = None
    expert_labels_were_remapped: bool = False
    prediction_remap_mode: str | None = None
    prediction_remap_note: str | None = None
    prediction_labels_were_remapped: bool | None = None
    mapping_source: str | None = None
    mapping_confidence: str | None = None
    comparison_scope: str | None = None
    mapping_failure_reason_code: str | None = None
    expert_has_ggo: bool | None = None
    expert_has_reticulation: bool | None = None
    expert_has_consolidation: bool | None = None
    prediction_has_ggo: bool | None = None
    prediction_has_reticulation: bool | None = None
    prediction_has_consolidation: bool | None = None
    voxel_count_expert: dict[str, int] = Field(default_factory=dict)
    voxel_count_prediction: dict[str, int] = Field(default_factory=dict)
    dice_vacuous_both_empty: dict[str, bool] = Field(default_factory=dict)
    foreground_overlap_voxels: int = Field(default=0, ge=0)
    expert_foreground_voxels: int = Field(default=0, ge=0)
    prediction_foreground_voxels: int = Field(default=0, ge=0)
    voxel_agreement_fraction: float = Field(default=0.0, ge=0.0, le=1.0)
    interpretation_hint: str | None = None
    expert_stack_mode: str | None = None
    expert_inplane_correction: str | None = None
    expert_slices_matched: int | None = Field(default=None, ge=0)


# ---------------------------------------------------------------------------
# DICOM geometry & segmentation sync
# ---------------------------------------------------------------------------


class DicomVolumeShape(BaseModel):
    """Axial depth × H × W on disk; matches slice API indexing."""

    depth: int = Field(..., ge=1)
    height: int = Field(..., ge=1)
    width: int = Field(..., ge=1)
    spacing_z_mm: float = Field(..., ge=0)
    spacing_y_mm: float = Field(..., ge=0)
    spacing_x_mm: float = Field(..., ge=0)


class SegmentationGeometry(BaseModel):
    """Voxel grid metadata for segmentation revisions."""

    shape_zyx: list[int] = Field(..., min_length=3, max_length=3)
    spacing_zyx_mm: list[float] = Field(..., min_length=3, max_length=3)
    orientation: str = Field(default="zyx", min_length=3, max_length=8)

    @field_validator("shape_zyx")
    @classmethod
    def _validate_shape(cls, value: list[int]) -> list[int]:
        if (
            len(value) != 3
            or any(int(v) <= 0 or int(v) > 8192 for v in value)
            or math.prod(int(v) for v in value) > 96_000_000
        ):
            raise ValueError("shape_zyx exceeds the supported 3D volume limits")
        return [int(v) for v in value]

    @field_validator("spacing_zyx_mm")
    @classmethod
    def _validate_spacing(cls, value: list[float]) -> list[float]:
        if len(value) != 3 or any(
            not math.isfinite(float(v)) or float(v) <= 0 or float(v) > 1000
            for v in value
        ):
            raise ValueError("spacing_zyx_mm must contain 3 finite values in (0, 1000]")
        return [float(v) for v in value]


class SegmentationRevisionCreate(BaseModel):
    """Slicer / AI push payload for ``POST .../segmentation-revisions``."""

    source: Literal["ai", "slicer", "slicer_bridge", "manual"] = "slicer_bridge"
    revision_note: str | None = Field(default=None, max_length=1000)
    module_name: str | None = Field(default=None, max_length=200)
    module_version: str | None = Field(default=None, max_length=100)
    workstation_id: str | None = Field(default=None, max_length=200)
    geometry: SegmentationGeometry
    labels: dict[str, int] = Field(
        default_factory=lambda: {
            "background": 0,
            "left": 1,
            "right": 2,
        },
        min_length=3,
        max_length=3,
    )
    mask_b64: str = Field(..., min_length=4, max_length=128_000_000)

    @field_validator("revision_note", "module_name", "module_version", "workstation_id")
    @classmethod
    def _reject_control_characters(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if any(ord(char) < 32 and char not in "\t" for char in cleaned):
            raise ValueError("metadata must not contain control characters")
        return cleaned or None


class SegmentationRevisionInfo(BaseModel):
    revision_id: int
    source: str
    revision_note: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
    accepted_at: datetime | None = None
    failed_at: datetime | None = None
    status: Literal["pending", "accepted", "failed"] = "accepted"
    failure_reason: str | None = None
    authenticated_user_id: str | None = None
    module_name: str | None = None
    module_version: str | None = None
    workstation_id: str | None = None
    rollback_of_revision_id: int | None = None
    geometry: SegmentationGeometry
    labels: dict[str, int]
    mask_url: str
    mesh_url: str | None = None
    stl_url: str | None = None


class SegmentationSyncStatus(BaseModel):
    study_id: str
    current_revision_id: int
    latest: SegmentationRevisionInfo | None = None


class SegmentationUpdateResponse(BaseModel):
    study_id: str
    revision_id: int
    accepted_at: datetime
    status: Literal["accepted"] = "accepted"
    mesh_url: str | None = None
    stl_url: str | None = None
    metrics: dict[str, float] = Field(default_factory=dict)


class SegmentationRollbackCreate(BaseModel):
    revision_note: str | None = Field(default=None, max_length=1000)
    module_name: str | None = Field(default=None, max_length=200)
    module_version: str | None = Field(default=None, max_length=100)
    workstation_id: str | None = Field(default=None, max_length=200)


# ---------------------------------------------------------------------------
# Practitioner settings
# ---------------------------------------------------------------------------

VolumeDisplayUnit = Literal["mm", "cm", "ml", "percent"]


def _normalize_volume_display_unit(value: str) -> str:
    v = value.lower().strip()
    aliases = {
        "mm3": "mm",
        "mm³": "mm",
        "cm3": "cm",
        "cm³": "cm",
        "pct": "percent",
        "%": "percent",
    }
    v = aliases.get(v, v)
    allowed = {"mm", "cm", "ml", "percent"}
    if v not in allowed:
        raise ValueError(f"unit_measurement must be one of {sorted(allowed)}")
    return v


class PractitionerSettings(BaseModel):
    email_on_analysis: bool = True
    in_app_alerts: bool = True
    default_view: str = "2d"
    unit_measurement: VolumeDisplayUnit = "mm"
    pacs_api_key: str | None = None
    pacs_endpoint: str | None = None


class PractitionerSettingsUpdate(BaseModel):
    email_on_analysis: bool | None = None
    in_app_alerts: bool | None = None
    default_view: str | None = None
    unit_measurement: VolumeDisplayUnit | None = None
    pacs_api_key: str | None = None
    pacs_endpoint: str | None = None

    @field_validator("unit_measurement", mode="before")
    @classmethod
    def _validate_unit_measurement(cls, value: object) -> object:
        if value is None:
            return value
        if not isinstance(value, str):
            return value
        return _normalize_volume_display_unit(value)


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


class Notification(BaseModel):
    id: int
    title: str
    message: str = ""
    type: str = "info"
    read_at: str | None = None
    created_at: str


class NotificationListResponse(BaseModel):
    unread_count: int
    notifications: list[Notification]


class NotificationCreate(BaseModel):
    title: str
    message: str | None = None
    type: str | None = "info"


__all__ = [
    "AdminUserListItem",
    "AuthResponse",
    "DicomVolumeShape",
    "ExpertMaskCompareResponse",
    "ForgotPasswordRequest",
    "LoginRequest",
    "Notification",
    "NotificationCreate",
    "NotificationListResponse",
    "Patient",
    "PatientCreate",
    "PatientUpdate",
    "PractitionerSettings",
    "PractitionerSettingsUpdate",
    "ResetPasswordRequest",
    "SegmentationGeometry",
    "SegmentationResult",
    "SegmentationRevisionCreate",
    "SegmentationRevisionInfo",
    "SegmentationRollbackCreate",
    "SegmentationSyncStatus",
    "SegmentationUpdateResponse",
    "SignupRequest",
    "SlicerTokenRequest",
    "SlicerTokenResponse",
    "Study",
    "StudyListItem",
    "StudyMetrics",
    "UploadStudyResponse",
    "UserResponse",
    "VolumeDisplayUnit",
    "XRView",
    "_normalize_volume_display_unit",
]
