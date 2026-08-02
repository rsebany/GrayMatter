"""Resolved paths for CLI scripts (run from platform root or backend-api/)."""
from __future__ import annotations

import os
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
BACKEND_API_DIR = SCRIPTS_DIR.parent
PLATFORM_ROOT = BACKEND_API_DIR.parent
MONOREPO_ROOT = PLATFORM_ROOT.parent
BACKEND_AI_DIR = Path(
    os.environ.get(
        "GRAYMATTER_BACKEND_AI_ROOT",
        str(MONOREPO_ROOT / "GrayMatter-research" / "backend-ai"),
    )
)
DEFAULT_WEIGHTS_PATH = BACKEND_API_DIR / "weights" / "best_metric_model.pth"

# Legacy alias for scripts that expect PROJECT_ROOT = platform root
PROJECT_ROOT = PLATFORM_ROOT


def default_api_base() -> str:
    return (
        os.environ.get("GRAYMATTER_API_BASE_URL")
        or os.environ.get("NEXT_PUBLIC_API_BASE_URL")
        or "http://127.0.0.1:8000"
    )
