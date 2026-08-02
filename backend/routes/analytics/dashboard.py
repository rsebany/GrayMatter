"""Analytics dashboard aggregates (study volume, dice, pending, throughput)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Query, Session

from auth import TokenPayload, get_current_user, studies_query
from models.db import get_session
from models.models import SegmentationResultORM, StudyORM

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/analytics", tags=["analytics"])

# ---------------------------------------------------------------------------
# Turnaround heuristic (placeholder until real upload→segmentation timing)
# ---------------------------------------------------------------------------

_TURNAROUND_MIN_HOURS = 2.0
_TURNAROUND_MAX_HOURS = 6.0
_TURNAROUND_BASE_HOURS = 4.0
_TURNAROUND_RECENT_DIVISOR = 50.0
_TURNAROUND_SAMPLE_LIMIT = 100


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------


def _today_start_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _scoped_studies(session: Session, current_user: TokenPayload) -> Query:
    return studies_query(session, current_user)


def _count_studies(session: Session, current_user: TokenPayload) -> int:
    return int(_scoped_studies(session, current_user).count())


def _mean_dice_score(session: Session, current_user: TokenPayload) -> float:
    rows = (
        _scoped_studies(session, current_user)
        .join(SegmentationResultORM, StudyORM.id == SegmentationResultORM.study_id)
        .with_entities(SegmentationResultORM.dice_score)
        .filter(SegmentationResultORM.dice_score.isnot(None))
        .all()
    )
    scores = [float(d[0]) for d in rows if d[0] is not None]
    if not scores:
        return 0.0
    return sum(scores) / len(scores)


def _count_pending_studies(session: Session, current_user: TokenPayload) -> int:
    return int(
        _scoped_studies(session, current_user)
        .outerjoin(SegmentationResultORM, StudyORM.id == SegmentationResultORM.study_id)
        .filter(SegmentationResultORM.id.is_(None))
        .with_entities(func.count(StudyORM.id))
        .scalar()
        or 0
    )


def _count_completed_today(
    session: Session,
    current_user: TokenPayload,
    today_start: datetime,
) -> int:
    return int(
        _scoped_studies(session, current_user)
        .join(SegmentationResultORM, StudyORM.id == SegmentationResultORM.study_id)
        .filter(StudyORM.created_at >= today_start)
        .with_entities(func.count(StudyORM.id))
        .scalar()
        or 0
    )


def _estimate_turnaround_hours(session: Session, current_user: TokenPayload) -> float:
    """Heuristic from recent completed-study volume (not wall-clock segmentation time)."""
    completed = (
        _scoped_studies(session, current_user)
        .join(SegmentationResultORM, StudyORM.id == SegmentationResultORM.study_id)
        .filter(StudyORM.created_at.isnot(None))
        .with_entities(StudyORM.created_at)
        .order_by(StudyORM.created_at.desc())
        .limit(_TURNAROUND_SAMPLE_LIMIT)
        .all()
    )
    if not completed:
        return 0.0
    recent_count = len(completed)
    return max(
        _TURNAROUND_MIN_HOURS,
        min(
            _TURNAROUND_MAX_HOURS,
            _TURNAROUND_BASE_HOURS - (recent_count / _TURNAROUND_RECENT_DIVISOR),
        ),
    )


def _build_dashboard_metrics(
    session: Session,
    current_user: TokenPayload,
) -> dict[str, float | int]:
    today_start = _today_start_utc()
    return {
        "mean_dice": float(_mean_dice_score(session, current_user)),
        "studies_count": _count_studies(session, current_user),
        "pending_count": _count_pending_studies(session, current_user),
        "completed_today": _count_completed_today(session, current_user, today_start),
        "avg_turnaround_hours": float(_estimate_turnaround_hours(session, current_user)),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/dashboard-metrics",
    summary="Dashboard aggregates for the current user",
    name="analytics_dashboard_metrics",
)
async def dashboard_metrics(
    current_user: TokenPayload = Depends(get_current_user),
) -> dict[str, float | int]:
    """Study counts, mean dice, pending queue, completed today, turnaround hint."""
    with get_session() as session:
        return _build_dashboard_metrics(session, current_user)
