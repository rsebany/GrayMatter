"""Role → permission matrix for API authorization."""

from __future__ import annotations

from models.models import ROLE_ADMIN, ROLE_RADIOLOGIST, ROLE_REFERRING

# ---------------------------------------------------------------------------
# Permission flags per role
# ---------------------------------------------------------------------------

ROLES = {
    ROLE_RADIOLOGIST: {
        "upload_mri": True,
        "trigger_ai": True,
        "explore_3d_xr": True,
        "manage_patients": True,
        "quantitative_metrics": True,
        "view_shared_3d": True,
        "system_maintenance": False,
        "user_management": False,
    },
    ROLE_REFERRING: {
        "upload_mri": False,
        "trigger_ai": False,
        "explore_3d_xr": True,
        "manage_patients": False,
        "quantitative_metrics": True,
        "view_shared_3d": True,
        "system_maintenance": False,
        "user_management": False,
    },
    ROLE_ADMIN: {
        "upload_mri": False,
        "trigger_ai": False,
        "explore_3d_xr": False,
        "manage_patients": False,
        "quantitative_metrics": False,
        "view_shared_3d": False,
        "system_maintenance": True,
        "user_management": True,
    },
}


def has_permission(role: str, permission: str) -> bool:
    # Product policy: radiologists and admins are full-access users.
    if role in (ROLE_RADIOLOGIST, ROLE_ADMIN):
        return True
    return ROLES.get(role, {}).get(permission, False)


__all__ = ["ROLES", "has_permission"]
