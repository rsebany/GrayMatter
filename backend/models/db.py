"""PostgreSQL engine, schema bootstrap, and session management."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator
from urllib.parse import urlparse, urlunparse

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from .models import Base

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is required and must point to a PostgreSQL database."
    )

# ---------------------------------------------------------------------------
# Engine & session factory
# ---------------------------------------------------------------------------

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# Database bootstrap
# ---------------------------------------------------------------------------


def _ensure_database_exists() -> None:
    """Create the target database if missing (connects via default ``postgres`` db)."""
    parsed = urlparse(DATABASE_URL)
    db_name = parsed.path.lstrip("/") or "postgres"
    if db_name == "postgres":
        return

    default_url = urlunparse(parsed._replace(path="/postgres"))
    default_engine = create_engine(default_url, isolation_level="AUTOCOMMIT")
    with default_engine.connect() as conn:
        row = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": db_name}
        ).fetchone()
        if not row:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    default_engine.dispose()


def _patch_patients_user_id_column() -> None:
    """Add patients.user_id on existing databases and backfill from study owners."""
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE patients
                ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_patients_user_id ON patients (user_id)
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE patients AS p
                SET user_id = sub.user_id
                FROM (
                    SELECT DISTINCT ON (s.patient_id) s.patient_id, s.user_id
                    FROM studies AS s
                    WHERE s.user_id IS NOT NULL
                    ORDER BY s.patient_id, s.created_at ASC
                ) AS sub
                WHERE p.id = sub.patient_id AND p.user_id IS NULL
                """
            )
        )
        conn.commit()


def _patch_segmentations_inference_architecture_column() -> None:
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE segmentations
                ADD COLUMN IF NOT EXISTS inference_architecture VARCHAR
                """
            )
        )
        conn.commit()


def _patch_segmentations_stl_url_column() -> None:
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE segmentations
                ADD COLUMN IF NOT EXISTS stl_url VARCHAR DEFAULT ''
                """
            )
        )
        conn.commit()


def init_db() -> None:
    """Create tables defined by ORM models."""
    _ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    _patch_patients_user_id_column()
    _patch_segmentations_inference_architecture_column()
    _patch_segmentations_stl_url_column()


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------


@contextmanager
def get_session() -> Iterator[Session]:
    """Context manager: commit on success, rollback on error, always close."""
    session = SessionLocal()
    try:
        yield session
        if session.is_active:
            session.commit()
    except Exception:
        if session.is_active:
            session.rollback()
        raise
    finally:
        session.close()


__all__ = [
    "DATABASE_URL",
    "SessionLocal",
    "engine",
    "get_session",
    "init_db",
]
