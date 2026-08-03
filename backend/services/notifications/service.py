"""DB helpers for in-app notifications (reusable from jobs / future hooks)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from models.db import get_session
from models.models import NotificationORM, UserORM
from schemas import Notification

logger = logging.getLogger(__name__)

__all__ = [
    "create_notification_sync",
    "notify_ai_analysis_complete",
    "notify_ai_analysis_failed",
    "orm_to_notification",
]

# ---------------------------------------------------------------------------
# Create & serialize
# ---------------------------------------------------------------------------


def create_notification_sync(
    title: str,
    message: str = "",
    notif_type: str = "info",
    user_id: int | None = None,
) -> None:
    if user_id is None:
        raise ValueError("user_id is required to create a notification")

    with get_session() as session:
        user_exists = session.query(UserORM.id).filter(UserORM.id == user_id).scalar()
        if not user_exists:
            raise ValueError(f"User {user_id} not found")

        new_notif = NotificationORM(
            title=title,
            message=message,
            type=notif_type,
            user_id=user_id,
        )
        session.add(new_notif)
        session.commit()


def notify_ai_analysis_complete(*, study_id: str, user_id: int, context: str = "metrics") -> None:
    """Best-effort in-app alert after a successful AI run (upload or re-analysis)."""
    detail = "mesh and metrics were updated" if context == "mesh" else "mask and metrics were updated"
    try:
        create_notification_sync(
            title="AI analysis complete",
            message=f"Study {study_id} {detail}.",
            notif_type="analysis",
            user_id=user_id,
        )
    except Exception:
        logger.exception(
            "Failed to create AI completion notification for study %s (user_id=%s)",
            study_id,
            user_id,
        )


def notify_ai_analysis_failed(*, study_id: str, user_id: int, error: str) -> None:
    """Best-effort in-app alert when AI analysis fails."""
    try:
        create_notification_sync(
            title="AI analysis failed",
            message=error or f"Study {study_id} analysis failed.",
            notif_type="analysis",
            user_id=user_id,
        )
    except Exception:
        logger.exception(
            "Failed to create AI failure notification for study %s (user_id=%s)",
            study_id,
            user_id,
        )


def orm_to_notification(n: NotificationORM) -> Notification:
    return Notification(
        id=n.id,
        title=n.title,
        message=n.message or "",
        type=n.type or "info",
        read_at=n.read_at.isoformat() if n.read_at else None,
        created_at=n.created_at.isoformat() if n.created_at else datetime.now(timezone.utc).isoformat(),
    )
