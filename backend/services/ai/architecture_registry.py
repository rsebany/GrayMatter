"""Registered hippocampus segmentation architecture for platform inference."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path

from config import BACKEND_AI_ROOT, WEIGHTS_PATH

DEFAULT_ARCHITECTURE_ID = "hybrid_attunet"
_DEFAULT_CONFIG = BACKEND_AI_ROOT / "configs" / "hybrid_attention_v1.json"
_CV_METRICS = BACKEND_AI_ROOT / "graymatter_train_results" / "cv_metrics.csv"

ARCHITECTURE_LABEL = "Hybrid Attention U-Net (Coordinate Attention)"


@dataclass(frozen=True)
class ArchitectureSpec:
    id: str
    label: str
    builder: str
    checkpoint_path: Path
    config: dict
    best_val_dice: float | None
    available: bool
    is_default: bool


def _load_config() -> dict:
    if _DEFAULT_CONFIG.is_file():
        return json.loads(_DEFAULT_CONFIG.read_text(encoding="utf-8"))
    return {"builder": "hybrid_attention_unet", "num_classes": 3}


def _read_cv_best_dice() -> float | None:
    if not _CV_METRICS.is_file():
        return None
    best: float | None = None
    with _CV_METRICS.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                dice = float(row["dice_mean"])
            except (KeyError, TypeError, ValueError):
                continue
            if best is None or dice > best:
                best = dice
    return best


def resolve_architecture(architecture_id: str | None = None) -> ArchitectureSpec:
    arch_id = (architecture_id or DEFAULT_ARCHITECTURE_ID).strip()

    if arch_id != DEFAULT_ARCHITECTURE_ID:
        raise FileNotFoundError(
            f"Architecture '{arch_id}' is not supported. "
            "GrayMatter ships a single architecture: Hybrid Attention U-Net "
            "(Coordinate Attention)."
        )

    if not WEIGHTS_PATH.is_file():
        raise FileNotFoundError(
            f"Production checkpoint not found at {WEIGHTS_PATH}. "
            "Download the release asset and place it as ai/checkpoints/model.pt "
            "(see README.md / docs/INSTALL.md; "
            "https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention)."
        )

    config = _load_config()
    return ArchitectureSpec(
        id=DEFAULT_ARCHITECTURE_ID,
        label=ARCHITECTURE_LABEL,
        builder="hybrid_attention_unet",
        checkpoint_path=WEIGHTS_PATH,
        config=config,
        best_val_dice=_read_cv_best_dice(),
        available=True,
        is_default=True,
    )


def list_architectures() -> list[ArchitectureSpec]:
    if not WEIGHTS_PATH.is_file():
        return []
    return [resolve_architecture()]


__all__ = [
    "DEFAULT_ARCHITECTURE_ID",
    "ArchitectureSpec",
    "list_architectures",
    "resolve_architecture",
]
