"""Pydantic request/response models shared by routes and services."""
from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    role: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


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
    lung_volume_ml: Optional[float] = Field(default=None, ge=0)
    ild_burden: Optional[float] = Field(default=None, ge=0, le=1)
    ggo_volume_ml: Optional[float] = Field(default=None, ge=0)
    reticulation_volume_ml: Optional[float] = Field(default=None, ge=0)
    consolidation_volume_ml: Optional[float] = Field(default=None, ge=0)
    ggo_burden: Optional[float] = Field(default=None, ge=0, le=1)
    reticulation_burden: Optional[float] = Field(default=None, ge=0, le=1)
    consolidation_burden: Optional[float] = Field(default=None, ge=0, le=1)
    hippocampus_volume_ml: Optional[float] = Field(default=None, ge=0)
    left_hippocampus_ml: Optional[float] = Field(default=None, ge=0)
    right_hippocampus_ml: Optional[float] = Field(default=None, ge=0)
    zonal_distribution: Dict[str, float] = Field(default_factory=dict)
    mesh_url: str
    stl_url: str = ""
    xr_view: Optional[XRView] = None
    visualization_mode: Literal["2d", "3d", "xr", "mixed"] = "mixed"
    dice_score: Optional[float] = Field(None, ge=0, le=100)


class Study(BaseModel):
    id: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    modality: str = "mri"
    segmentation: Optional[SegmentationResult] = None


class Patient(BaseModel):
    id: str
    name: str
    dateOfBirth: Optional[date] = None
    notes: Optional[str] = None
    studies: List[Study] = []


class PatientCreate(BaseModel):
    name: str
    dateOfBirth: Optional[date] = None
    notes: Optional[str] = None
    sex: Optional[str] = None


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    dateOfBirth: Optional[date] = None
    notes: Optional[str] = None


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
    acquisition_date: Optional[datetime] = None
    zonal_distribution: Dict[str, float] = Field(default_factory=dict)
    lung_volume_ml: Optional[float] = None
    ggo_volume_ml: Optional[float] = None
    reticulation_volume_ml: Optional[float] = None
    consolidation_volume_ml: Optional[float] = None
    ggo_burden: Optional[float] = None
    reticulation_burden: Optional[float] = None
    consolidation_burden: Optional[float] = None


class UploadStudyResponse(BaseModel):
    """``POST /studies/upload`` (DICOM ZIP/folder or NIfTI)."""

    study_id: str
    patient: Patient


class StudyMetrics(BaseModel):
    """``GET /studies/{study_id}/metrics``."""

    study_id: str
    volume_total_mm3: float
    ild_fraction: float
    hippocampus_volume_ml: Optional[float] = Field(default=None, ge=0)
    left_hippocampus_ml: Optional[float] = Field(default=None, ge=0)
    right_hippocampus_ml: Optional[float] = Field(default=None, ge=0)
    zonal_distribution: Dict[str, float] = Field(default_factory=dict)
    lung_volume_ml: Optional[float] = None
    ggo_volume_ml: Optional[float] = None
    reticulation_volume_ml: Optional[float] = None
    consolidation_volume_ml: Optional[float] = None
    ggo_burden: Optional[float] = None
    reticulation_burden: Optional[float] = None
    consolidation_burden: Optional[float] = None
    ild_burden: Optional[float] = None
    architecture_id: Optional[str] = None
    architecture_label: Optional[str] = None


class ArchitectureOption(BaseModel):
    """``GET /studies/architectures``."""

    id: str
    label: str
    builder: str
    best_val_dice: Optional[float] = Field(default=None, ge=0, le=1)
    is_default: bool = False
    available: bool = True


# ---------------------------------------------------------------------------
# Expert mask compare
# ---------------------------------------------------------------------------


class ExpertMaskCompareResponse(BaseModel):
    """``POST /studies/upload/expert-mask-compare``."""

    study_id: str
    expert_shape: List[int] = Field(..., min_length=3, max_length=3)
    prediction_shape: List[int] = Field(..., min_length=3, max_length=3)
    dice: Dict[str, float] = Field(default_factory=dict)
    expert_label_max_seen: int = Field(..., ge=0)
    expert_labels_were_clipped: bool = False
    expert_remap_mode: str = "unknown"
    expert_remap_note: Optional[str] = None
    expert_labels_were_remapped: bool = False
    prediction_remap_mode: Optional[str] = None
    prediction_remap_note: Optional[str] = None
    prediction_labels_were_remapped: Optional[bool] = None
    mapping_source: Optional[str] = None
    mapping_confidence: Optional[str] = None
    comparison_scope: Optional[str] = None
    mapping_failure_reason_code: Optional[str] = None
    expert_has_ggo: Optional[bool] = None
    expert_has_reticulation: Optional[bool] = None
    expert_has_consolidation: Optional[bool] = None
    prediction_has_ggo: Optional[bool] = None
    prediction_has_reticulation: Optional[bool] = None
    prediction_has_consolidation: Optional[bool] = None
    voxel_count_expert: Dict[str, int] = Field(default_factory=dict)
    voxel_count_prediction: Dict[str, int] = Field(default_factory=dict)
    dice_vacuous_both_empty: Dict[str, bool] = Field(default_factory=dict)
    foreground_overlap_voxels: int = Field(default=0, ge=0)
    expert_foreground_voxels: int = Field(default=0, ge=0)
    prediction_foreground_voxels: int = Field(default=0, ge=0)
    voxel_agreement_fraction: float = Field(default=0.0, ge=0.0, le=1.0)
    interpretation_hint: Optional[str] = None
    expert_stack_mode: Optional[str] = None
    expert_inplane_correction: Optional[str] = None
    expert_slices_matched: Optional[int] = Field(default=None, ge=0)


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

    shape_zyx: List[int] = Field(..., min_length=3, max_length=3)
    spacing_zyx_mm: List[float] = Field(..., min_length=3, max_length=3)
    orientation: str = "zyx"

    @field_validator("shape_zyx")
    @classmethod
    def _validate_shape(cls, value: List[int]) -> List[int]:
        if len(value) != 3 or any(int(v) <= 0 for v in value):
            raise ValueError("shape_zyx must contain exactly 3 positive integers")
        return [int(v) for v in value]

    @field_validator("spacing_zyx_mm")
    @classmethod
    def _validate_spacing(cls, value: List[float]) -> List[float]:
        if len(value) != 3 or any(float(v) <= 0 for v in value):
            raise ValueError("spacing_zyx_mm must contain exactly 3 positive values")
        return [float(v) for v in value]


class SegmentationRevisionCreate(BaseModel):
    """Slicer / AI push payload for ``POST .../segmentation-revisions``."""

    source: Literal["ai", "slicer", "slicer_bridge", "manual"] = "slicer_bridge"
    revision_note: Optional[str] = None
    geometry: SegmentationGeometry
    labels: Dict[str, int] = Field(
        default_factory=lambda: {
            "background": 0,
            "ggo": 1,
            "reticulation": 2,
            "consolidation": 3,
        }
    )
    mask_b64: str = Field(..., min_length=4)


class SegmentationRevisionInfo(BaseModel):
    revision_id: int
    source: str
    revision_note: Optional[str] = None
    created_at: datetime
    geometry: SegmentationGeometry
    labels: Dict[str, int]
    mask_url: str
    mesh_url: Optional[str] = None


class SegmentationSyncStatus(BaseModel):
    study_id: str
    current_revision_id: int
    latest: Optional[SegmentationRevisionInfo] = None


class SegmentationUpdateResponse(BaseModel):
    study_id: str
    revision_id: int
    accepted_at: datetime
    mesh_url: Optional[str] = None
    stl_url: Optional[str] = None
    metrics: Dict[str, float] = Field(default_factory=dict)


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
    pacs_api_key: Optional[str] = None
    pacs_endpoint: Optional[str] = None


class PractitionerSettingsUpdate(BaseModel):
    email_on_analysis: Optional[bool] = None
    in_app_alerts: Optional[bool] = None
    default_view: Optional[str] = None
    unit_measurement: Optional[VolumeDisplayUnit] = None
    pacs_api_key: Optional[str] = None
    pacs_endpoint: Optional[str] = None

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
    read_at: Optional[str] = None
    created_at: str


class NotificationListResponse(BaseModel):
    unread_count: int
    notifications: List[Notification]


class NotificationCreate(BaseModel):
    title: str
    message: Optional[str] = None
    type: Optional[str] = "info"


__all__ = [
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
    "SegmentationSyncStatus",
    "SegmentationUpdateResponse",
    "SignupRequest",
    "Study",
    "StudyListItem",
    "StudyMetrics",
    "UploadStudyResponse",
    "AdminUserListItem",
    "UserResponse",
    "VolumeDisplayUnit",
    "XRView",
    "_normalize_volume_display_unit",
]
