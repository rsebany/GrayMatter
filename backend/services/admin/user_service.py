"""Admin user directory — create, update, delete practitioner accounts."""

from __future__ import annotations

from auth import _generate_medical_id, hash_password
from models.models import (
    ROLE_ADMIN,
    ROLE_RADIOLOGIST,
    ROLE_REFERRING,
    UserORM,
)
from schemas import AdminUserListItem
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

VALID_ADMIN_ROLES = (ROLE_RADIOLOGIST, ROLE_REFERRING, ROLE_ADMIN)


def _validate_role(role: str) -> str:
    if role not in VALID_ADMIN_ROLES:
        raise ValueError(
            f"Invalid role {role!r}. Choose one of: {', '.join(VALID_ADMIN_ROLES)}"
        )
    return role


def to_admin_user_item(user: UserORM) -> AdminUserListItem:
    return AdminUserListItem(
        id=user.id,
        medical_id=user.medical_id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
    )


def list_users(session: Session) -> list[AdminUserListItem]:
    rows = (
        session.query(UserORM)
        .order_by(UserORM.created_at.desc(), UserORM.id.desc())
        .all()
    )
    return [to_admin_user_item(row) for row in rows]


def create_user(
    session: Session,
    *,
    full_name: str,
    email: str,
    role: str,
    password: str,
) -> AdminUserListItem:
    role = _validate_role(role)
    normalized_email = email.strip().lower()
    existing = (
        session.query(UserORM).filter(UserORM.email == normalized_email).first()
    )
    if existing:
        raise ValueError("Email already registered")

    user = UserORM(
        medical_id=_generate_medical_id(),
        full_name=full_name.strip(),
        email=normalized_email,
        password_hash=hash_password(password),
        role=role,
    )
    session.add(user)
    session.flush()
    session.refresh(user)
    return to_admin_user_item(user)


def update_user(
    session: Session,
    user_id: int,
    *,
    full_name: str | None = None,
    email: str | None = None,
    role: str | None = None,
    password: str | None = None,
) -> AdminUserListItem:
    user = session.query(UserORM).filter(UserORM.id == user_id).first()
    if not user:
        raise LookupError("User not found")

    if full_name is not None:
        user.full_name = full_name.strip()
    if email is not None:
        normalized_email = email.strip().lower()
        taken = (
            session.query(UserORM)
            .filter(UserORM.email == normalized_email, UserORM.id != user_id)
            .first()
        )
        if taken:
            raise ValueError("Email already registered")
        user.email = normalized_email
    if role is not None:
        user.role = _validate_role(role)
    if password is not None:
        user.password_hash = hash_password(password)

    session.flush()
    session.refresh(user)
    return to_admin_user_item(user)


def delete_user(session: Session, user_id: int, *, actor_id: int) -> None:
    if user_id == actor_id:
        raise ValueError("You cannot delete your own account")

    user = session.query(UserORM).filter(UserORM.id == user_id).first()
    if not user:
        raise LookupError("User not found")

    if user.role == ROLE_ADMIN:
        admin_count = (
            session.query(UserORM).filter(UserORM.role == ROLE_ADMIN).count()
        )
        if admin_count <= 1:
            raise ValueError("Cannot delete the last admin account")

    try:
        session.delete(user)
        session.flush()
    except IntegrityError as exc:
        raise ValueError(
            "User has linked patients or studies and cannot be deleted"
        ) from exc
