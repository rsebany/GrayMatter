"""Experiment configuration for Lightweight Hybrid Attention U-Net."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_config_path() -> Path:
    return Path(__file__).resolve().parent / "hybrid_attention_v1.json"


@dataclass
class ExperimentConfig:
    seed: int = 42
    num_folds: int = 5
    folds_to_run: list[int] = field(default_factory=lambda: [1, 2, 3, 4, 5])
    num_classes: int = 3
    roi_size: tuple[int, int, int] = (48, 64, 48)
    num_crop_samples: int = 1
    batch_size: int = 2
    num_workers: int = -1
    max_epochs: int = 300
    early_stopping_patience: int = 30
    lr: float = 5e-4
    weight_decay: float = 1e-5
    warmup_epochs: int = 10
    warmup_start_factor: float = 0.01
    scheduler: str = "warmup_cosine"
    use_amp: bool = True
    cudnn_benchmark: bool = True
    grad_clip_norm: float = 1.0
    lambda_dice: float = 1.5
    lambda_ce: float = 1.0
    loss_squared_pred: bool = False
    foreground_ce_boost: float = 1.25
    bottleneck_dropout_p: float = 0.1
    normalize_mode: str = "minmax"
    intensity_range: tuple[int, int] = (0, 2500)
    orientation: str = "RAS"
    target_spacing: tuple[float, float, float] = (1.0, 1.0, 1.0)
    apply_spacing: bool = False
    sw_overlap: float = 0.5
    sw_batch_size: int = 2
    output_dir: str = "ai/graymatter_train_results"
    submission_dir: str = "ai/graymatter_train_results/Submissions"
    dataset_slug_hint: str | None = None
    continue_on_fold_error: bool = True
    class_voxel_counts: tuple[int, ...] = (15_469_002, 445_938, 410_816)
    model_channels: tuple[int, ...] = (32, 64, 128, 256)
    skip_mode: str = "full"  # identity | coord_only | full
    model_version: str = "v1.0.0-lightweight-attunet"
    production_fold: int = 4

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ExperimentConfig:
        normalized = dict(data)
        for key in ("roi_size", "intensity_range", "target_spacing", "model_channels", "class_voxel_counts"):
            if key in normalized and isinstance(normalized[key], list):
                normalized[key] = tuple(normalized[key])
        if "folds_to_run" in normalized:
            normalized["folds_to_run"] = [int(x) for x in normalized["folds_to_run"]]
        allowed = {f.name for f in cls.__dataclass_fields__.values()}
        return cls(**{k: v for k, v in normalized.items() if k in allowed})

    @classmethod
    def from_json(cls, path: str | Path | None = None) -> ExperimentConfig:
        config_path = Path(path) if path else default_config_path()
        with config_path.open(encoding="utf-8") as handle:
            return cls.from_dict(json.load(handle))

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def save_json(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as handle:
            json.dump(self.to_dict(), handle, indent=2)


def load_experiment_config(path: str | Path | None = None) -> ExperimentConfig:
    quick_run = os.environ.get("QUICK_RUN", "0") == "1"
    config = ExperimentConfig.from_json(path)
    if quick_run:
        config.max_epochs = 5
        config.early_stopping_patience = 3
        config.folds_to_run = [1]
    return config
