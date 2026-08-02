"""Torch device selection and AI service logger."""
from __future__ import annotations

import logging
import os

import torch


def _env_bool(name: str, default: bool = False) -> bool:
    """Parse common truthy env-var values."""
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


torch.set_num_threads(int(os.getenv("TORCH_NUM_THREADS", "2")))
FORCE_CPU = _env_bool("AI_FORCE_CPU", default=False)
DEVICE = "cpu" if FORCE_CPU else ("cuda" if torch.cuda.is_available() else "cpu")
logger = logging.getLogger("services.ai")

__all__ = ["DEVICE", "FORCE_CPU", "logger"]
