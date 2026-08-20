"""Session routes: login, signup, current user profile, token refresh."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from models.db import get_session
from models.models import ROLE_RADIOLOGIST, UserORM
from schemas import (
    AuthResponse,
    LoginRequest,
    RefreshTokenRequest,
    SignupRequest,
    SlicerTokenRequest,
    SlicerTokenResponse,
    UserResponse,
)
from sqlalchemy.orm import Session

from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    _generate_medical_id,
    create_access_token,
    create_refresh_token,
    create_slicer_integration_token,
    decode_token,
    get_current_user,
    get_owned_study_or_404,
    has_permission,
    hash_password,
    verify_password,
)
from auth.tokens import TokenPayload

from .common import token_data, user_to_response

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _auth_response(user: UserORM) -> AuthResponse:
    data = token_data(user)
    return AuthResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_to_response(user),
    )


def _find_user_by_email(session: Session, email: str) -> UserORM | None:
    return session.query(UserORM).filter(UserORM.email == email).first()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login (JWT)",
    name="auth_login",
)
def login(body: LoginRequest) -> AuthResponse:
    """Email + password; returns access token and user."""
    with get_session() as session:
        user = _find_user_by_email(session, body.email)
        if not user or not verify_password(body.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        return _auth_response(user)


@router.post(
    "/signup",
    response_model=AuthResponse,
    summary="Sign up (JWT)",
    name="auth_signup",
)
def signup(body: SignupRequest) -> AuthResponse:
    """New practitioner account; returns access token and user."""
    with get_session() as session:
        if _find_user_by_email(session, body.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        user = UserORM(
            medical_id=_generate_medical_id(),
            full_name=body.full_name,
            email=body.email,
            password_hash=hash_password(body.password),
            role=body.role or ROLE_RADIOLOGIST,
        )
        session.add(user)
        session.flush()
        return _auth_response(user)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Current user profile",
    name="auth_me",
)
def me(current_user: Annotated[TokenPayload, Depends(get_current_user)]) -> UserResponse:
    """User claims from the bearer JWT."""
    return UserResponse(
        id=int(current_user.sub),
        medical_id=current_user.medical_id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
    )


@router.post(
    "/slicer-token",
    response_model=SlicerTokenResponse,
    summary="Issue a short-lived study-scoped Slicer integration token",
    name="auth_slicer_token",
)
def slicer_token(
    body: SlicerTokenRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> SlicerTokenResponse:
    """Exchange a normal authenticated session for a narrow revision-write token."""
    if not has_permission(current_user.role, "trigger_ai"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Segmentation editing permission is required",
        )
    with get_session() as session:
        get_owned_study_or_404(session, body.study_id, current_user)
    token, expires_at = create_slicer_integration_token(
        current_user.model_dump(
            include={"sub", "email", "role", "medical_id", "full_name"}
        ),
        body.study_id,
    )
    return SlicerTokenResponse(
        access_token=token,
        study_id=body.study_id,
        expires_at=expires_at,
    )


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------


@router.post(
    "/refresh",
    response_model=AuthResponse,
    summary="Refresh access token",
    name="auth_refresh",
)
def refresh_token(body: RefreshTokenRequest) -> AuthResponse:
    """Exchange a valid refresh token for a new access + refresh token pair."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("token_type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    with get_session() as session:
        user = session.query(UserORM).filter(UserORM.id == int(payload["sub"])).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
    return _auth_response(user)
