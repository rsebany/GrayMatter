"""CLI entrypoint for hippocampus hybrid attention U-Net training."""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parents[1]
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

import numpy as np
import torch
from configs.experiment_config import load_experiment_config
from monai.utils import set_determinism
from training.loops import run_fold_training

VARIANT_CONFIGS: dict[str, tuple[str, str]] = {
    "plain_unet": ("plain_unet_v1.json", "ai/results/ablations/plain_unet"),
    "coord_attention": ("coord_attention_v1.json", "ai/results/ablations/coord_attention"),
    "full_cisa": ("hybrid_attention_v1.json", "ai/results/ablations/full_cisa"),
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _resolve_dataset_root() -> Path:
    root = _repo_root() / "dataset"
    processed = root / "processed"
    if (processed / "images").exists():
        return processed
    return root / "raw"


def _get_manifest_cases(manifest: dict, split: str) -> list[dict]:
    if split == "train":
        if "train" in manifest:
            return manifest["train"]
        return manifest["training"]["cases"]
    if "val" in manifest:
        return manifest["val"]
    return manifest["validation"]["cases"]


def load_fold_cases(fold_idx: int, dataset_root: Path) -> tuple[list[dict], list[dict]]:
    manifest_path = _repo_root() / "dataset" / "manifests" / f"fold{fold_idx}.json"
    with manifest_path.open(encoding="utf-8") as handle:
        manifest = json.load(handle)

    def to_case(entry: dict) -> dict:
        image_name = entry.get("image") or entry.get("image_path")
        label_name = entry.get("label") or entry.get("label_path")
        image_path = _repo_root() / image_name
        label_path = _repo_root() / label_name
        if not image_path.exists():
            image_path = dataset_root / "images" / Path(image_name).name
        if not label_path.exists():
            label_path = dataset_root / "labels" / Path(label_name).name
        return {
            "case_id": entry.get("case_id") or Path(image_name).stem,
            "image": str(image_path),
            "label": str(label_path),
        }

    train_cases = [to_case(entry) for entry in _get_manifest_cases(manifest, "train")]
    val_cases = [to_case(entry) for entry in _get_manifest_cases(manifest, "val")]
    return train_cases, val_cases


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    set_determinism(seed=seed)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train Hybrid Attention U-Net")
    parser.add_argument("--config", default=None, help="Path to experiment JSON config")
    parser.add_argument(
        "--variant",
        choices=sorted(VARIANT_CONFIGS.keys()),
        default=None,
        help="Ablation variant (overrides --config and sets output_dir)",
    )
    parser.add_argument("--folds", default="1,2,3,4,5", help="Comma-separated fold indices")
    parser.add_argument("--output-dir", default=None)
    args = parser.parse_args(argv)

    config_path = args.config
    if args.variant:
        rel_config, default_out = VARIANT_CONFIGS[args.variant]
        config_path = config_path or str(_repo_root() / "ai" / "configs" / rel_config)
        if args.output_dir is None:
            args.output_dir = default_out

    config_path = config_path or str(_repo_root() / "ai" / "configs" / "hybrid_attention_v1.json")
    config = load_experiment_config(config_path)
    if args.output_dir:
        config.output_dir = args.output_dir
    output_dir = Path(config.output_dir)
    if not output_dir.is_absolute():
        output_dir = _repo_root() / output_dir

    folds = [int(x.strip()) for x in args.folds.split(",") if x.strip()]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if config.cudnn_benchmark and torch.cuda.is_available():
        torch.backends.cudnn.benchmark = True

    set_seed(config.seed)
    dataset_root = _resolve_dataset_root()
    all_metrics = []

    for fold_idx in folds:
        print(f"Starting fold {fold_idx} using dataset root {dataset_root}")
        train_cases, val_cases = load_fold_cases(fold_idx, dataset_root)
        try:
            _, _, metrics, _ = run_fold_training(
                fold_idx, train_cases, val_cases, config, output_dir, device
            )
            all_metrics.append(metrics)
        except Exception as exc:
            print(f"Fold {fold_idx} failed: {exc}")
            if not config.continue_on_fold_error:
                raise

    if all_metrics:
        summary = {
            "mean_dice": float(np.mean([m["dice_mean"] for m in all_metrics])),
            "std_dice": float(np.std([m["dice_mean"] for m in all_metrics])),
            "mean_dice_anterior": float(np.mean([m["dice_anterior"] for m in all_metrics])),
            "mean_dice_posterior": float(np.mean([m["dice_posterior"] for m in all_metrics])),
            "n_folds": len(all_metrics),
        }
        with (output_dir / "cv_summary.json").open("w", encoding="utf-8") as handle:
            json.dump(summary, handle, indent=2)
        config.save_json(output_dir / "config.json")
        print(f"CV complete. Mean Dice={summary['mean_dice']:.4f}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
