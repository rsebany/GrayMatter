"""Make backend-api and backend-ai importable when scripts are run directly."""
from __future__ import annotations

import sys

from .paths import BACKEND_AI_DIR, BACKEND_API_DIR


def ensure_backend_api_on_path() -> None:
    path = str(BACKEND_API_DIR)
    if path not in sys.path:
        sys.path.insert(0, path)


def ensure_backend_ai_on_path() -> None:
    path = str(BACKEND_AI_DIR)
    if path not in sys.path:
        sys.path.insert(0, path)
