"""In-app notification list, read, create, delete, and clear."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import TokenPayload, get_current_user_optional
from models.db import get_session
from models.models import NotificationORM
from schemas import Notification, NotificationCreate, NotificationListResponse
from services.notifications.service import orm_to_notification

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


def _require_user(current_user: TokenPayload | None) -> TokenPayload:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return current_user


def _user_id(current_user: TokenPayload) -> int:
    return int(current_user.sub)


def _get_owned_notification(
    session: Session,
    notification_id: int,
    user_id: int,
) -> NotificationORM:
    row = (
        session.query(NotificationORM)
        .filter(NotificationORM.id == notification_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if row.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return row


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------


def _list_for_user(
    session: Session,
    user_id: int,
    *,
    limit: int,
    unread_only: bool,
) -> NotificationListResponse:
    query = session.query(NotificationORM).filter(NotificationORM.user_id == user_id)
    unread_count = query.filter(NotificationORM.read_at.is_(None)).count()

    if unread_only:
        query = query.filter(NotificationORM.read_at.is_(None))

    rows = query.order_by(NotificationORM.created_at.desc()).limit(limit).all()
    return NotificationListResponse(
        unread_count=unread_count,
        notifications=[orm_to_notification(r) for r in rows],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications",
    name="notifications_list",
)
async def list_notifications(
    limit: int = 20,
    unread_only: bool = False,
    current_user: Optional[TokenPayload] = Depends(get_current_user_optional),
) -> NotificationListResponse:
    """Notifications for the current user (empty list when unauthenticated)."""
    if not current_user:
        return NotificationListResponse(unread_count=0, notifications=[])

    with get_session() as session:
        return _list_for_user(
            session, _user_id(current_user), limit=limit, unread_only=unread_only
        )


@router.patch(
    "/{notification_id}/read",
    summary="Mark notification read",
    name="notifications_mark_read",
)
async def mark_notification_read(
    notification_id: int,
    current_user: Optional[TokenPayload] = Depends(get_current_user_optional),
) -> dict:
    user = _require_user(current_user)
    with get_session() as session:
        row = _get_owned_notification(session, notification_id, _user_id(user))
        row.read_at = datetime.now(timezone.utc)
    return {"ok": True}


@router.post(
    "",
    response_model=Notification,
    status_code=201,
    summary="Create notification for current user",
    name="notifications_create",
)
async def create_notification(
    payload: NotificationCreate,
    current_user: Optional[TokenPayload] = Depends(get_current_user_optional),
) -> Notification:
    user = _require_user(current_user)
    with get_session() as session:
        n = NotificationORM(
            user_id=_user_id(user),
            title=payload.title,
            message=payload.message or "",
            type=payload.type or "info",
        )
        session.add(n)
        session.flush()
        return orm_to_notification(n)


@router.delete(
    "/{notification_id}",
    summary="Delete one notification",
    name="notifications_delete_one",
)
async def delete_notification(
    notification_id: int,
    current_user: Optional[TokenPayload] = Depends(get_current_user_optional),
) -> dict:
    user = _require_user(current_user)
    with get_session() as session:
        row = _get_owned_notification(session, notification_id, _user_id(user))
        session.delete(row)
    return {"ok": True}


@router.delete(
    "",
    summary="Clear all my notifications",
    name="notifications_clear",
)
async def clear_notifications(
    current_user: Optional[TokenPayload] = Depends(get_current_user_optional),
) -> dict:
    user = _require_user(current_user)
    with get_session() as session:
        deleted = (
            session.query(NotificationORM)
            .filter(NotificationORM.user_id == _user_id(user))
            .delete(synchronize_session=False)
        )
    return {"ok": True, "deleted": deleted}
