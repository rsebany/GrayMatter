"""GrayMatter API configuration (env-backed paths)."""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PLATFORM_ROOT = BASE_DIR.parent
MONOREPO_ROOT = PLATFORM_ROOT.parent

_DEFAULT_AI_ROOT = PLATFORM_ROOT / "ai"
_raw_ai_root = os.environ.get("GRAYMATTER_AI_ROOT") or os.environ.get("GRAYMATTER_BACKEND_AI_ROOT")
if _raw_ai_root:
    _ai_root = Path(_raw_ai_root)
    BACKEND_AI_ROOT = _ai_root if _ai_root.is_absolute() else (BASE_DIR / _ai_root).resolve()
else:
    BACKEND_AI_ROOT = _DEFAULT_AI_ROOT

WORKER_SCRIPT = BACKEND_AI_ROOT / "training" / "train.py"

_default_weights = PLATFORM_ROOT / "ai" / "checkpoints" / "model.pt"
_raw_checkpoint = os.environ.get("GRAYMATTER_CHECKPOINT")
if _raw_checkpoint:
    _checkpoint = Path(_raw_checkpoint)
    WEIGHTS_PATH = _checkpoint if _checkpoint.is_absolute() else (BASE_DIR / _checkpoint).resolve()
else:
    WEIGHTS_PATH = _default_weights

MRI_SAMPLES_DIR = PLATFORM_ROOT / "dataset" / "raw" / "images"
ARCHITECTURES_DIR = BACKEND_AI_ROOT / "configs"
UPLOAD_STORAGE = BASE_DIR / "data" / "uploads"

# Legacy alias
REPO_ROOT = PLATFORM_ROOT

__all__ = [
    "ARCHITECTURES_DIR",
    "BACKEND_AI_ROOT",
    "BASE_DIR",
    "MONOREPO_ROOT",
    "MRI_SAMPLES_DIR",
    "PLATFORM_ROOT",
    "REPO_ROOT",
    "UPLOAD_STORAGE",
    "WEIGHTS_PATH",
    "WORKER_SCRIPT",
]
