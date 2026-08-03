"""Admin user directory — list, create, update, and delete practitioner accounts."""

from __future__ import annotations

from typing import Annotated

from auth import require_role
from auth.tokens import TokenPayload
from fastapi import APIRouter, Depends, HTTPException, status
from models.db import get_session
from schemas import AdminCreateUserRequest, AdminUpdateUserRequest, AdminUserListItem
from services.admin.user_service import (
    create_user,
    delete_user,
    list_users,
    update_user,
)

router = APIRouter()


def _http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, LookupError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ValueError):
        code = (
            status.HTTP_409_CONFLICT
            if "already registered" in str(exc).lower()
            or "cannot delete" in str(exc).lower()
            or "linked patients" in str(exc).lower()
            else status.HTTP_400_BAD_REQUEST
        )
        return HTTPException(status_code=code, detail=str(exc))
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unexpected error",
    )


@router.get(
    "/users",
    response_model=list[AdminUserListItem],
    summary="List practitioner accounts",
    name="admin_list_users",
)
def admin_list_users(
    _admin: Annotated[TokenPayload, Depends(require_role("user_management"))],
) -> list[AdminUserListItem]:
    """Accounts without password hashes — for the admin dashboard."""
    with get_session() as session:
        return list_users(session)


@router.post(
    "/users",
    response_model=AdminUserListItem,
    status_code=status.HTTP_201_CREATED,
    summary="Create practitioner account",
    name="admin_create_user",
)
def admin_create_user(
    body: AdminCreateUserRequest,
    _admin: Annotated[TokenPayload, Depends(require_role("user_management"))],
) -> AdminUserListItem:
    with get_session() as session:
        try:
            return create_user(
                session,
                full_name=body.full_name,
                email=str(body.email),
                role=body.role,
                password=body.password,
            )
        except (LookupError, ValueError) as exc:
            raise _http_error(exc) from exc


@router.patch(
    "/users/{user_id}",
    response_model=AdminUserListItem,
    summary="Update practitioner account",
    name="admin_update_user",
)
def admin_update_user(
    user_id: int,
    body: AdminUpdateUserRequest,
    _admin: Annotated[TokenPayload, Depends(require_role("user_management"))],
) -> AdminUserListItem:
    with get_session() as session:
        try:
            return update_user(
                session,
                user_id,
                full_name=body.full_name,
                email=str(body.email) if body.email is not None else None,
                role=body.role,
                password=body.password,
            )
        except (LookupError, ValueError) as exc:
            raise _http_error(exc) from exc


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete practitioner account",
    name="admin_delete_user",
)
def admin_delete_user(
    user_id: int,
    admin: Annotated[TokenPayload, Depends(require_role("user_management"))],
) -> None:
    with get_session() as session:
        try:
            delete_user(session, user_id, actor_id=int(admin.sub))
        except (LookupError, ValueError) as exc:
            raise _http_error(exc) from exc
