"""Practitioner preferences (notifications, default view, PACS hooks)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import TokenPayload, get_current_user
from models.db import get_session
from models.models import SettingsORM
from schemas import PractitionerSettings, PractitionerSettingsUpdate, _normalize_volume_display_unit

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/settings", tags=["settings"])

_DEFAULT_VIEW = "2d"
_DEFAULT_VOLUME_UNIT = "mm"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _settings_to_response(row: SettingsORM) -> PractitionerSettings:
    return PractitionerSettings(
        email_on_analysis=row.email_on_analysis,
        in_app_alerts=row.in_app_alerts,
        default_view=row.default_view or _DEFAULT_VIEW,
        unit_measurement=row.unit_measurement or _DEFAULT_VOLUME_UNIT,
        pacs_api_key=row.pacs_api_key,
        pacs_endpoint=row.pacs_endpoint,
    )


def _default_settings_row(user_id: int) -> SettingsORM:
    return SettingsORM(
        user_id=user_id,
        email_on_analysis=True,
        in_app_alerts=True,
        default_view=_DEFAULT_VIEW,
        unit_measurement=_DEFAULT_VOLUME_UNIT,
    )


def _get_or_create_settings(session: Session, user_id: int) -> SettingsORM:
    row = session.query(SettingsORM).filter(SettingsORM.user_id == user_id).first()
    if row:
        return row
    row = _default_settings_row(user_id)
    session.add(row)
    session.flush()
    return row


def _apply_settings_update(row: SettingsORM, payload: PractitionerSettingsUpdate) -> None:
    update_data = getattr(
        payload, "model_dump", getattr(payload, "dict", lambda **kw: {}))(exclude_unset=True)
    if "unit_measurement" in update_data and update_data["unit_measurement"] is not None:
        update_data["unit_measurement"] = _normalize_volume_display_unit(
            str(update_data["unit_measurement"])
        )
    for key, value in update_data.items():
        setattr(row, key, value)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=PractitionerSettings,
    summary="Get practitioner settings",
    name="settings_get",
)
async def get_settings(
    current_user: TokenPayload = Depends(get_current_user),
) -> PractitionerSettings:
    user_id = int(current_user.sub)
    with get_session() as session:
        return _settings_to_response(_get_or_create_settings(session, user_id))


@router.put(
    "",
    response_model=PractitionerSettings,
    summary="Update practitioner settings",
    name="settings_update",
)
async def save_settings(
    payload: PractitionerSettingsUpdate,
    current_user: TokenPayload = Depends(get_current_user),
) -> PractitionerSettings:
    user_id = int(current_user.sub)
    with get_session() as session:
        row = session.query(SettingsORM).filter(SettingsORM.user_id == user_id).first()
        if not row:
            row = SettingsORM(user_id=user_id)
            session.add(row)
        _apply_settings_update(row, payload)
        session.flush()
        return _settings_to_response(row)
