"""Out-of-fold rigorous evaluation helpers.

CV DSC and OOF DSC use the *same* checkpoint ``best_model.pth`` — weights at the
epoch that maximized that fold's own validation Dice during training. OOF
reloads those weights, re-infers each held-out validation case with the MONAI
multi-metric pipeline, and pools the mean over all 260 cases. Both protocols
score held-out folds; they are not a train-vs-test split difference.

Sanity check before interpreting a CV-vs-OOF gap: for each fold,
``|fold_level_oof.dice_mean - eval_metrics.best_dice|`` should be small (same
weights, same cases). Large gaps may indicate metric-stack or checkpoint-load
differences rather than a true generalization effect.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from configs.experiment_config import ExperimentConfig
from evaluation.metrics import compute_case_metrics
from models.hybrid_attention_unet import build_model
from monai.data import CacheDataset
from preprocessing.transforms import get_val_transforms, predict_volume
from torch.utils.data import DataLoader


def repo_root_from_ai() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve_dataset_root(repo_root: Path) -> Path:
    processed = repo_root / "dataset" / "processed"
    if (processed / "images").exists():
        return processed
    return repo_root / "dataset" / "raw"


def load_fold_manifest(repo_root: Path, fold_idx: int) -> tuple[list[dict], list[dict]]:
    path = repo_root / "dataset" / "manifests" / f"fold{fold_idx}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    dataset_root = resolve_dataset_root(repo_root)

    def to_loader_case(entry: dict) -> dict:
        image_rel = entry["image"]
        label_rel = entry["label"]
        image_path = repo_root / image_rel
        label_path = repo_root / label_rel
        if not image_path.exists():
            image_path = dataset_root / "images" / Path(image_rel).name
        if not label_path.exists():
            label_path = dataset_root / "labels" / Path(label_rel).name
        return {
            "case_id": entry["case_id"],
            "image": str(image_path),
            "label": str(label_path),
        }

    train = [to_loader_case(c) for c in data["training"]["cases"]]
    val = [to_loader_case(c) for c in data["validation"]["cases"]]
    return train, val


def _resolve_production_cv_dice(
    results_dir: Path,
    repo_root: Path,
    production_fold: int,
) -> float | None:
    """Prefer matched ablation fold metrics; fall back to legacy cv_metrics.csv."""
    eval_metrics_path = results_dir / f"fold{production_fold}" / "eval_metrics.json"
    if eval_metrics_path.exists():
        data = json.loads(eval_metrics_path.read_text(encoding="utf-8"))
        if "best_dice" in data:
            return float(data["best_dice"])

    legacy_cv_path = repo_root / "ai" / "results" / "cv_metrics.csv"
    if legacy_cv_path.exists():
        legacy_cv = pd.read_csv(legacy_cv_path)
        prod_row = legacy_cv[legacy_cv["fold"] == production_fold]
        if not prod_row.empty:
            return float(prod_row["dice_mean"].iloc[0])
    return None


def resolve_checkpoint(results_dir: Path, fold_idx: int) -> Path | None:
    candidates = [
        results_dir / f"fold{fold_idx}" / "checkpoints" / "best_model.pth",
        results_dir / f"fold{fold_idx}" / "best_model.pth",
        results_dir / f"fold{fold_idx}" / "checkpoints" / "best.pt",
        results_dir / f"fold{fold_idx}" / "best.pt",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def remap_ablation_state_dict(state_dict: dict) -> dict:
    """Map compact state-dict keys to package model names."""
    import re

    patterns = (
        (r"^e(\d)\.b\.", r"enc\1.block."),
        (r"^d(\d)\.b\.", r"dec\1.block."),
        (r"^bn\.0\.b\.", "bottleneck.block."),
        (r"^out\.", "final."),
        (r"^s(\d)\.bd\.", r"skip\1.branch_d."),
        (r"^s(\d)\.bh\.", r"skip\1.branch_h."),
        (r"^s(\d)\.bw\.", r"skip\1.branch_w."),
        (r"^s(\d)\.inter\.", r"skip\1.inter_slice."),
        (r"^u(\d)\.", r"up\1."),
    )

    remapped: dict = {}
    for key, value in state_dict.items():
        new_key = key
        for pattern, repl in patterns:
            new_key = re.sub(pattern, repl, new_key)
        remapped[new_key] = value
    return remapped


def load_model_from_checkpoint(
    checkpoint_path: Path,
    base_config: ExperimentConfig,
    device: torch.device,
) -> tuple[torch.nn.Module, ExperimentConfig]:
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    run_config = base_config
    if isinstance(checkpoint, dict) and "config" in checkpoint:
        saved = checkpoint["config"]
        if isinstance(saved, dict):
            run_config = ExperimentConfig.from_dict(saved)
    model = build_model(run_config).to(device)
    if isinstance(checkpoint, dict):
        state_dict = (
            checkpoint.get("model_state_dict")
            or checkpoint.get("state_dict")
            or checkpoint.get("model")
        )
        if state_dict is None:
            state_dict = checkpoint
    else:
        state_dict = checkpoint
    if isinstance(state_dict, dict) and any(k.startswith("e1.b.") for k in state_dict):
        state_dict = remap_ablation_state_dict(state_dict)
    missing, unexpected = model.load_state_dict(state_dict, strict=False)
    if missing or unexpected:
        # Prefer hard fail when nothing matched (wrong architecture / naming).
        n_model = len(model.state_dict())
        n_loaded = n_model - len(missing)
        if n_loaded == 0:
            raise RuntimeError(
                f"Failed to load any weights from {checkpoint_path} "
                f"(missing={len(missing)}, unexpected={len(unexpected)})"
            )
    model.eval()
    return model, run_config


def bootstrap_ci(
    values: np.ndarray,
    n_samples: int = 10_000,
    alpha: float = 0.05,
    seed: int = 42,
) -> dict[str, float]:
    clean = values[~np.isnan(values)]
    if clean.size == 0:
        return {"mean": float("nan"), "ci_low": float("nan"), "ci_high": float("nan"), "n": 0}
    rng = np.random.default_rng(seed)
    boot_means = np.empty(n_samples, dtype=np.float64)
    for i in range(n_samples):
        sample = rng.choice(clean, size=clean.size, replace=True)
        boot_means[i] = sample.mean()
    return {
        "mean": float(clean.mean()),
        "ci_low": float(np.percentile(boot_means, 100 * alpha / 2)),
        "ci_high": float(np.percentile(boot_means, 100 * (1 - alpha / 2))),
        "n": int(clean.size),
    }


def run_oof_evaluation(
    repo_root: Path,
    config: ExperimentConfig,
    results_dir: Path,
    output_dir: Path,
    device: torch.device,
    *,
    max_cases_per_fold: int | None = None,
    bootstrap_samples: int = 10_000,
    production_fold: int = 4,
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    pred_cache_dir = output_dir / "oof_predictions"
    pred_cache_dir.mkdir(parents=True, exist_ok=True)

    per_case_rows: list[dict] = []
    skipped_folds: list[int] = []

    for fold_idx in range(1, 6):
        ckpt_path = resolve_checkpoint(results_dir, fold_idx)
        if ckpt_path is None:
            skipped_folds.append(fold_idx)
            continue

        _, val_cases = load_fold_manifest(repo_root, fold_idx)
        if max_cases_per_fold is not None:
            val_cases = val_cases[:max_cases_per_fold]

        model, run_config = load_model_from_checkpoint(ckpt_path, config, device)
        val_ds = CacheDataset(val_cases, transform=get_val_transforms(run_config), cache_rate=1.0)
        val_loader = DataLoader(val_ds, batch_size=1, shuffle=False, num_workers=0)

        with torch.no_grad():
            for batch_idx, batch in enumerate(val_loader):
                case_id = batch["case_id"][0] if isinstance(batch["case_id"], (list, tuple)) else batch["case_id"]
                matching = val_cases[batch_idx]
                if matching["case_id"] != case_id:
                    matching = next(c for c in val_cases if c["case_id"] == case_id)

                images = batch["image"].to(device)
                labels = batch["label"].to(device)
                outputs = predict_volume(model, images, run_config)

                row = compute_case_metrics(outputs, labels, run_config.num_classes, matching["label"])
                pred_mask = torch.argmax(outputs, dim=1).squeeze(0).cpu().numpy().astype(np.uint8)
                np.save(pred_cache_dir / f"{case_id}.npy", pred_mask)

                row["case_id"] = case_id
                row["eval_fold"] = fold_idx
                row["checkpoint"] = str(ckpt_path)
                per_case_rows.append(row)

        del model
        if device.type == "cuda":
            torch.cuda.empty_cache()

    per_case_df = pd.DataFrame(per_case_rows)
    per_case_path = output_dir / "per_case_metrics.csv"
    per_case_df.to_csv(per_case_path, index=False)

    numeric_cols = [
        c for c in per_case_df.columns
        if c not in {"case_id", "eval_fold", "checkpoint"} and pd.api.types.is_numeric_dtype(per_case_df[c])
    ]

    oof_summary: dict = {
        "n_cases": len(per_case_df),
        "n_folds_evaluated": int(per_case_df["eval_fold"].nunique()) if not per_case_df.empty else 0,
        "skipped_folds": skipped_folds,
    }
    for col in numeric_cols:
        oof_summary[f"{col}_mean"] = float(per_case_df[col].mean()) if not per_case_df.empty else None
        oof_summary[f"{col}_std"] = float(per_case_df[col].std()) if not per_case_df.empty else None

    with (output_dir / "oof_summary.json").open("w", encoding="utf-8") as handle:
        json.dump(oof_summary, handle, indent=2)

    fold_level = (
        per_case_df.groupby("eval_fold")[numeric_cols].mean().reset_index()
        if not per_case_df.empty else pd.DataFrame()
    )
    fold_level.to_csv(output_dir / "fold_level_oof_summary.csv", index=False)

    bias_rows: list[dict] = []
    if not per_case_df.empty:
        prod_cv_dice = _resolve_production_cv_dice(results_dir, repo_root, production_fold)
        if prod_cv_dice is not None:
            bias_rows.append({
                "source": f"fold{production_fold}_cv_validation",
                "dice_mean": prod_cv_dice,
                "note": "Best-fold validation (optimistic selection)",
            })
        bias_rows.append({
            "source": "oof_all_cases",
            "dice_mean": float(per_case_df["dice_mean"].mean()),
            "note": "Unbiased OOF estimate",
        })
        for _, row in fold_level.iterrows():
            bias_rows.append({
                "source": f"oof_fold{int(row['eval_fold'])}",
                "dice_mean": float(row["dice_mean"]),
                "note": "OOF mean for this fold's val cases",
            })
    pd.DataFrame(bias_rows).to_csv(output_dir / "fold_selection_bias.csv", index=False)

    bootstrap_metrics = ["dice_mean", "hd95_mean", "asd_mean", "iou_mean", "vol_rel_err_total", "vol_rel_err_mean"]
    bootstrap_results = {
        metric: bootstrap_ci(per_case_df[metric].to_numpy(), n_samples=bootstrap_samples, seed=config.seed)
        for metric in bootstrap_metrics
        if metric in per_case_df.columns and not per_case_df.empty
    }
    with (output_dir / "bootstrap_ci.json").open("w", encoding="utf-8") as handle:
        json.dump(bootstrap_results, handle, indent=2)

    if not per_case_df.empty:
        audit_cols = [
            "case_id", "eval_fold", "dice_mean", "dice_anterior", "dice_posterior",
            "hd95_mean", "asd_mean", "iou_mean", "vol_rel_err_total",
        ]
        per_case_df.sort_values("dice_mean", ascending=True).head(20)[audit_cols].to_csv(
            output_dir / "worst_cases_top20.csv", index=False
        )

    return {
        "per_case_df": per_case_df,
        "oof_summary": oof_summary,
        "bootstrap_results": bootstrap_results,
        "skipped_folds": skipped_folds,
        "output_dir": output_dir,
    }


def main() -> None:
    """CLI for the system-paper reproducibility checklist."""
    import argparse

    from configs.experiment_config import load_experiment_config

    parser = argparse.ArgumentParser(description="Out-of-fold multi-metric evaluation")
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Experiment JSON (default: hybrid_attention_v1.json)",
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        required=True,
        help="Directory with fold*/checkpoints/best_model.pth",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Directory for OOF CSV/JSON artifacts",
    )
    parser.add_argument("--device", type=str, default=None, help="cuda|cpu (default: auto)")
    parser.add_argument("--max-cases-per-fold", type=int, default=None)
    parser.add_argument("--production-fold", type=int, default=4)
    args = parser.parse_args()

    repo_root = repo_root_from_ai()
    config = load_experiment_config(args.config)
    if args.device:
        device = torch.device(args.device)
    else:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    result = run_oof_evaluation(
        repo_root=repo_root,
        config=config,
        results_dir=args.results_dir.resolve(),
        output_dir=args.output_dir.resolve(),
        device=device,
        max_cases_per_fold=args.max_cases_per_fold,
        production_fold=args.production_fold,
    )
    print(f"OOF complete → {result['output_dir']}")
    if result["skipped_folds"]:
        print(f"Skipped folds (missing checkpoint): {result['skipped_folds']}")


if __name__ == "__main__":
    main()
