"""Shared DB helpers for auth CLI scripts (create user, set password, list users)."""
from __future__ import annotations

import sys
from collections.abc import Iterable
from datetime import datetime

from common.bootstrap import ensure_backend_api_on_path

# Must run before `import auth` — scripts/auth/ would shadow backend-api/auth/.
ensure_backend_api_on_path()

from auth import _generate_medical_id, hash_password
from models.db import get_session
from models.models import (
    ROLE_ADMIN,
    ROLE_RADIOLOGIST,
    ROLE_REFERRING,
    UserORM,
)

VALID_ROLES = (ROLE_RADIOLOGIST, ROLE_REFERRING, ROLE_ADMIN)


def validate_role(role: str) -> str:
    if role not in VALID_ROLES:
        print(
            f"[ERROR] Invalid role {role!r}. Choose one of: {', '.join(VALID_ROLES)}",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return role


def find_user_by_email(email: str) -> UserORM | None:
    with get_session() as session:
        return session.query(UserORM).filter(UserORM.email == email).first()


def create_user_record(
    *,
    email: str,
    full_name: str,
    role: str,
    password: str,
) -> UserORM:
    role = validate_role(role)
    with get_session() as session:
        existing = session.query(UserORM).filter(UserORM.email == email).first()
        if existing:
            print(f"[ERROR] Email already registered: {email}", file=sys.stderr)
            raise SystemExit(1)
        user = UserORM(
            medical_id=_generate_medical_id(),
            full_name=full_name.strip(),
            email=email.strip().lower(),
            password_hash=hash_password(password),
            role=role,
        )
        session.add(user)
        session.flush()
        session.refresh(user)
        return user


def set_user_password(*, email: str, password: str) -> UserORM:
    with get_session() as session:
        user = session.query(UserORM).filter(UserORM.email == email).first()
        if not user:
            print(f"[ERROR] No user with email: {email}", file=sys.stderr)
            raise SystemExit(1)
        user.password_hash = hash_password(password)
        session.flush()
        session.refresh(user)
        return user


def iter_users() -> Iterable[UserORM]:
    with get_session() as session:
        rows = (
            session.query(UserORM)
            .order_by(UserORM.created_at.desc(), UserORM.id.desc())
            .all()
        )
        for row in rows:
            session.expunge(row)
            yield row


def format_created_at(value: datetime | None) -> str:
    if not value:
        return "—"
    if value.tzinfo:
        return value.astimezone().strftime("%Y-%m-%d %H:%M")
    return value.strftime("%Y-%m-%d %H:%M")


__all__ = [
    "VALID_ROLES",
    "create_user_record",
    "find_user_by_email",
    "format_created_at",
    "iter_users",
    "set_user_password",
    "validate_role",
]
