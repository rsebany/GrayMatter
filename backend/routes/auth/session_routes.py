"""Session routes: login, signup, current user profile."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import (
    _generate_medical_id,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from auth.tokens import TokenPayload
from models.db import get_session
from models.models import ROLE_RADIOLOGIST, UserORM
from schemas import AuthResponse, LoginRequest, SignupRequest, UserResponse

from .common import token_data, user_to_response

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _auth_response(user: UserORM) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(token_data(user)),
        token_type="bearer",
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
def me(current_user: TokenPayload = Depends(get_current_user)) -> UserResponse:
    """User claims from the bearer JWT."""
    return UserResponse(
        id=int(current_user.sub),
        medical_id=current_user.medical_id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
    )
