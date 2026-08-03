"""Patient ORM → API schema mapping and display-name rules."""

from __future__ import annotations

from models.models import PatientORM
from schemas import Patient
from services.patients.ids import generate_patient_external_id

# ---------------------------------------------------------------------------
# Display name
# ---------------------------------------------------------------------------

_PLACEHOLDER_DISPLAY_NAMES = frozenset(
    {
        "unknown",
        "unknown patient",
        "patient-unknown",
        "anonymous",
        "anonymized",
        "anonymised",
    }
)


def _resolve_patient_name(name: str | None, external_id: str) -> str:
    normalized = (name or "").strip()
    if not normalized:
        return external_id
    if normalized.lower() in _PLACEHOLDER_DISPLAY_NAMES:
        return external_id
    return normalized


# ---------------------------------------------------------------------------
# Schema mapping
# ---------------------------------------------------------------------------


def _segmentation_summary_dict(seg) -> dict:
    xr = seg.xr_view if seg else None
    return {
        "id": seg.external_id,
        "total_ild_volume_ml": seg.total_ild_volume_ml,
        "lung_volume_ml": seg.lung_volume_ml,
        "ild_burden": seg.ild_fraction,
        "ggo_volume_ml": seg.ggo_volume_ml,
        "reticulation_volume_ml": seg.reticulation_volume_ml,
        "consolidation_volume_ml": seg.consolidation_volume_ml,
        "ggo_burden": seg.ggo_burden,
        "reticulation_burden": seg.reticulation_burden,
        "consolidation_burden": seg.consolidation_burden,
        "zonal_distribution": seg.zonal_distribution or {},
        "mesh_url": seg.mesh_url,
        "stl_url": getattr(seg, "stl_url", "") or "",
        "xr_view": {
            "id": xr.external_id if xr else f"xr-{seg.external_id}",
            "mesh_url": seg.mesh_url,
            "stl_url": getattr(seg, "stl_url", "") or "",
            "clipping_enabled": bool(xr.clipping_enabled) if xr else True,
        },
        "visualization_mode": getattr(seg, "visualization_mode", "mixed"),
        "dice_score": seg.dice_score,
    }


def patient_orm_to_schema(p: PatientORM, *, owner_user_id: int | None = None) -> Patient:
    studies = []
    for st in p.studies or []:
        if owner_user_id is not None and st.user_id != owner_user_id:
            continue
        seg = st.segmentation
        studies.append(
            {
                "id": st.external_id,
                "patient_id": p.external_id,
                "description": st.description,
                "created_at": st.created_at.isoformat() if st.created_at else None,
                "modality": getattr(st, "modality", "mri"),
                "segmentation": None if not seg else _segmentation_summary_dict(seg),
            }
        )

    return Patient(
        id=p.external_id,
        name=_resolve_patient_name(p.name, p.external_id),
        dateOfBirth=p.date_of_birth,
        notes=p.notes,
        studies=studies,
    )


__all__ = ["_resolve_patient_name", "generate_patient_external_id", "patient_orm_to_schema"]
