"""JWT and password-reset timing (env-backed secret)."""

from __future__ import annotations

import os

# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
SLICER_TOKEN_EXPIRE_MINUTES = max(
    1,
    min(60, int(os.environ.get("GRAYMATTER_SLICER_TOKEN_TTL_MINUTES", "15"))),
)
SECRET_KEY = os.environ.get(
    "GRAYMATTER_JWT_SECRET",
    os.environ.get("ILD_JWT_SECRET", "graymatter-dev-secret-change-in-production"),
)

# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

RESET_TOKEN_EXPIRE_HOURS = 1

__all__ = [
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "ALGORITHM",
    "REFRESH_TOKEN_EXPIRE_MINUTES",
    "RESET_TOKEN_EXPIRE_HOURS",
    "SECRET_KEY",
    "SLICER_TOKEN_EXPIRE_MINUTES",
]
