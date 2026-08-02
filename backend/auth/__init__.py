from __future__ import annotations

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

from auth.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    RESET_TOKEN_EXPIRE_HOURS,
    SECRET_KEY,
)

# ---------------------------------------------------------------------------
# Identifiers & passwords
# ---------------------------------------------------------------------------

from auth.identifiers import _generate_medical_id
from auth.passwords import hash_password, verify_password

# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------

from auth.tokens import (
    TokenPayload,
    create_access_token,
    create_password_reset_token,
    decode_token,
    get_token_payload,
    hash_reset_token,
    verify_reset_token,
)

# ---------------------------------------------------------------------------
# Roles & FastAPI dependencies
# ---------------------------------------------------------------------------

from auth.roles import ROLES, has_permission
from auth.data_scope import (
    assert_patient_access,
    get_owned_patient_or_404,
    get_owned_study_or_404,
    is_unscoped_role,
    patients_query,
    studies_query,
    user_id_from_token,
)
from auth.dependencies import (
    bearer_scheme,
    get_current_user,
    get_current_user_from_bearer_or_query,
    get_current_user_optional,
    require_role,
)

# ---------------------------------------------------------------------------
# Public surface (stable imports for routes and services)
# ---------------------------------------------------------------------------

__all__ = [
    # config
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "ALGORITHM",
    "RESET_TOKEN_EXPIRE_HOURS",
    "SECRET_KEY",
    # identifiers / passwords
    "_generate_medical_id",
    "hash_password",
    "verify_password",
    # tokens
    "TokenPayload",
    "create_access_token",
    "create_password_reset_token",
    "decode_token",
    "get_token_payload",
    "hash_reset_token",
    "verify_reset_token",
    # data scope
    "assert_patient_access",
    "get_owned_patient_or_404",
    "get_owned_study_or_404",
    "is_unscoped_role",
    "patients_query",
    "studies_query",
    "user_id_from_token",
    # roles / deps
    "ROLES",
    "bearer_scheme",
    "get_current_user",
    "get_current_user_from_bearer_or_query",
    "get_current_user_optional",
    "has_permission",
    "require_role",
]
