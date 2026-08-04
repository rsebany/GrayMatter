"""Registered hippocampus segmentation architectures for platform inference."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path

from config import ARCHITECTURES_DIR, BACKEND_AI_ROOT, WEIGHTS_PATH

DEFAULT_ARCHITECTURE_ID = "lightweight_attunet"
_LIGHTWEIGHT_CONFIG = BACKEND_AI_ROOT / "configs" / "hybrid_attention_v1.json"
_CV_METRICS = BACKEND_AI_ROOT / "graymatter_train_results" / "cv_metrics.csv"

_ARCHITECTURE_LABELS: dict[str, str] = {
    "lightweight_attunet": "Lightweight Hybrid Attention U-Net (Coordinate Attention)",
    "residual_unet": "Residual U-Net",
    "segresnet": "SegResNet",
    "unetr": "UNETR",
    "attention_unet_50": "Attention U-Net",
}


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


def _load_lightweight_config() -> dict:
    if _LIGHTWEIGHT_CONFIG.is_file():
        return json.loads(_LIGHTWEIGHT_CONFIG.read_text(encoding="utf-8"))
    return {"builder": "lightweight_hybrid_attention_unet", "num_classes": 3}


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


def _read_comparison_csv() -> dict[str, float]:
    csv_path = ARCHITECTURES_DIR / "architecture_comparison.csv"
    if not csv_path.is_file():
        return {}
    scores: dict[str, float] = {}
    with csv_path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            arch_id = str(row.get("architecture", "")).strip()
            if not arch_id:
                continue
            try:
                scores[arch_id] = float(row["best_val_dice"])
            except (KeyError, TypeError, ValueError):
                continue
    return scores


def _architecture_dirs() -> list[Path]:
    research_dir = BACKEND_AI_ROOT.parent / "GrayMatter-research" / "architectures"
    if not research_dir.is_dir():
        return []
    return sorted(
        path
        for path in research_dir.iterdir()
        if path.is_dir() and (path / "config.json").is_file()
    )


def _resolve_checkpoint(arch_dir: Path) -> Path | None:
    for name in ("best_checkpoint.pth", "best.pt", "best_metric_model.pth", "model.pt"):
        candidate = arch_dir / name
        if candidate.is_file():
            return candidate
    return None


def resolve_architecture(architecture_id: str | None) -> ArchitectureSpec:
    arch_id = (architecture_id or DEFAULT_ARCHITECTURE_ID).strip()
    scores = _read_comparison_csv()

    if arch_id == DEFAULT_ARCHITECTURE_ID:
        if not WEIGHTS_PATH.is_file():
            raise FileNotFoundError(
                f"Production checkpoint not found at {WEIGHTS_PATH}. "
                "Download the release asset and place it as ai/checkpoints/model.pt "
                "(see README.md / docs/INSTALL.md; "
                "https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention)."
            )
        config = _load_lightweight_config()
        return ArchitectureSpec(
            id=DEFAULT_ARCHITECTURE_ID,
            label=_ARCHITECTURE_LABELS[DEFAULT_ARCHITECTURE_ID],
            builder="lightweight_hybrid_attention_unet",
            checkpoint_path=WEIGHTS_PATH,
            config=config,
            best_val_dice=_read_cv_best_dice() or scores.get(DEFAULT_ARCHITECTURE_ID),
            available=True,
            is_default=True,
        )

    for arch_dir in _architecture_dirs():
        if arch_dir.name != arch_id:
            continue
        config_path = arch_dir / "config.json"
        checkpoint = _resolve_checkpoint(arch_dir)
        if not config_path.is_file() or checkpoint is None:
            break
        config = json.loads(config_path.read_text(encoding="utf-8"))
        return ArchitectureSpec(
            id=arch_id,
            label=_ARCHITECTURE_LABELS.get(arch_id, arch_id.replace("_", " ").title()),
            builder=str(config.get("builder", arch_id)),
            checkpoint_path=checkpoint,
            config=config,
            best_val_dice=scores.get(arch_id),
            available=True,
            is_default=False,
        )

    raise FileNotFoundError(f"Architecture '{arch_id}' is not available on the server")


def list_architectures() -> list[ArchitectureSpec]:
    specs: list[ArchitectureSpec] = []
    if WEIGHTS_PATH.is_file():
        specs.append(resolve_architecture(DEFAULT_ARCHITECTURE_ID))

    scores = _read_comparison_csv()
    seen = {spec.id for spec in specs}
    for arch_dir in _architecture_dirs():
        arch_id = arch_dir.name
        if arch_id in seen:
            continue
        checkpoint = _resolve_checkpoint(arch_dir)
        config_path = arch_dir / "config.json"
        if checkpoint is None or not config_path.is_file():
            continue
        config = json.loads(config_path.read_text(encoding="utf-8"))
        specs.append(
            ArchitectureSpec(
                id=arch_id,
                label=_ARCHITECTURE_LABELS.get(arch_id, arch_id.replace("_", " ").title()),
                builder=str(config.get("builder", arch_id)),
                checkpoint_path=checkpoint,
                config=config,
                best_val_dice=scores.get(arch_id),
                available=True,
                is_default=False,
            )
        )

    specs.sort(
        key=lambda item: (
            0 if item.is_default else 1,
            -(item.best_val_dice or 0.0),
            item.label.lower(),
        )
    )
    return specs


__all__ = [
    "DEFAULT_ARCHITECTURE_ID",
    "ArchitectureSpec",
    "list_architectures",
    "resolve_architecture",
]
