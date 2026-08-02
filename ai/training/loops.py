"""Training loops and checkpoint persistence."""

from __future__ import annotations

import csv
import json
import time
from dataclasses import asdict
from pathlib import Path

import torch
import torch.nn as nn
from torch.amp import GradScaler, autocast
from tqdm.auto import tqdm

from configs.experiment_config import ExperimentConfig
from evaluation.metrics import compute_dice_scores
from models.hybrid_attention_unet import build_model
from preprocessing.transforms import predict_volume
from training.dataloaders import create_dataloaders
from training.losses import build_loss_fn


def save_checkpoint(path: Path, model: nn.Module, optimizer, epoch: int, best_dice: float, config: ExperimentConfig) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "best_dice": best_dice,
            "config": asdict(config),
        },
        path,
    )


def build_optimizer_and_scheduler(model: nn.Module, config: ExperimentConfig):
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.lr, weight_decay=config.weight_decay)
    warmup = torch.optim.lr_scheduler.LinearLR(
        optimizer,
        start_factor=config.warmup_start_factor,
        total_iters=max(config.warmup_epochs, 1),
    )
    cosine = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=max(config.max_epochs - config.warmup_epochs, 1),
    )
    scheduler = torch.optim.lr_scheduler.SequentialLR(
        optimizer,
        schedulers=[warmup, cosine],
        milestones=[config.warmup_epochs],
    )
    return optimizer, scheduler


def train_one_epoch(model, loader, loss_fn, optimizer, device, config, scaler) -> float:
    model.train()
    losses = []
    for batch in tqdm(loader, desc="train", leave=False):
        images = batch["image"].to(device)
        labels = batch["label"].to(device)
        optimizer.zero_grad(set_to_none=True)
        with autocast("cuda", enabled=config.use_amp and device.type == "cuda"):
            outputs = model(images)
            loss = loss_fn(outputs, labels)
        scaler.scale(loss).backward()
        if config.grad_clip_norm > 0:
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), config.grad_clip_norm)
        scaler.step(optimizer)
        scaler.update()
        losses.append(float(loss.item()))
    return float(sum(losses) / max(len(losses), 1))


def validate_epoch(model, loader, loss_fn, device, config) -> dict[str, float]:
    model.eval()
    losses = []
    dice_scores = {"dice_mean": 0.0, "dice_anterior": 0.0, "dice_posterior": 0.0}
    count = 0
    with torch.no_grad():
        for batch in tqdm(loader, desc="val", leave=False):
            images = batch["image"].to(device)
            labels = batch["label"].to(device)
            with autocast("cuda", enabled=config.use_amp and device.type == "cuda"):
                outputs = predict_volume(model, images, config)
                loss = loss_fn(outputs, labels)
            losses.append(float(loss.item()))
            batch_scores = compute_dice_scores(outputs, labels, config.num_classes)
            for key, value in batch_scores.items():
                dice_scores[key] += value
            count += 1
    if count:
        for key in dice_scores:
            dice_scores[key] /= count
    dice_scores["val_loss"] = float(sum(losses) / max(len(losses), 1))
    return dice_scores


def run_fold_training(
    fold_idx: int,
    train_cases: list[dict],
    val_cases: list[dict],
    config: ExperimentConfig,
    output_dir: Path,
    device: torch.device,
) -> tuple[nn.Module, list[dict], dict[str, float], float]:
    fold_dir = output_dir / f"fold{fold_idx}"
    ckpt_dir = fold_dir / "checkpoints"
    fold_dir.mkdir(parents=True, exist_ok=True)

    train_loader, val_loader = create_dataloaders(train_cases, val_cases, config)
    model = build_model(config).to(device)
    loss_fn = build_loss_fn(config, device)
    optimizer, scheduler = build_optimizer_and_scheduler(model, config)
    scaler = GradScaler("cuda", enabled=config.use_amp and device.type == "cuda")

    history: list[dict] = []
    best_scores = {"dice_mean": -1.0, "dice_anterior": 0.0, "dice_posterior": 0.0, "val_loss": 0.0}
    stale_epochs = 0
    t0 = time.perf_counter()

    for epoch in range(1, config.max_epochs + 1):
        train_loss = train_one_epoch(model, train_loader, loss_fn, optimizer, device, config, scaler)
        val_scores = validate_epoch(model, val_loader, loss_fn, device, config)
        scheduler.step()
        current_lr = optimizer.param_groups[0]["lr"]
        # Paper Table II (CV DSC): selection criterion = max validation Dice on
        # this fold's held-out set. The saved best_model.pth is the same file
        # later reloaded for OOF re-evaluation (Sections III-D / V-B).
        if val_scores["dice_mean"] > best_scores["dice_mean"]:
            best_scores = val_scores
            stale_epochs = 0
            save_checkpoint(fold_dir / "best_model.pth", model, optimizer, epoch, best_scores["dice_mean"], config)
        else:
            stale_epochs += 1
        save_checkpoint(ckpt_dir / "last.pth", model, optimizer, epoch, best_scores["dice_mean"], config)
        history.append(
            {
                "fold": fold_idx,
                "epoch": epoch,
                "train_loss": train_loss,
                "lr": current_lr,
                "val_loss": val_scores["val_loss"],
                **{f"val_{k}": v for k, v in val_scores.items() if k != "val_loss"},
                "best_dice_mean": best_scores["dice_mean"],
            }
        )
        print(
            f"Fold {fold_idx} | Epoch {epoch:03d} | lr={current_lr:.2e} | "
            f"train_loss={train_loss:.4f} | val_dice={val_scores['dice_mean']:.4f}"
        )
        if stale_epochs >= config.early_stopping_patience:
            print(f"Early stopping fold {fold_idx} at epoch {epoch}")
            break

    elapsed_min = (time.perf_counter() - t0) / 60.0
    with (fold_dir / "training_history.csv").open("w", newline="", encoding="utf-8") as handle:
        if history:
            writer = csv.DictWriter(handle, fieldnames=history[0].keys())
            writer.writeheader()
            writer.writerows(history)

    eval_metrics = {
        "dice_mean": best_scores["dice_mean"],
        "dice_anterior": best_scores["dice_anterior"],
        "dice_posterior": best_scores["dice_posterior"],
        "val_loss": best_scores["val_loss"],
        "fold": fold_idx,
        "best_val_dice_training": best_scores["dice_mean"],
        "best_val_dice_anterior": best_scores["dice_anterior"],
        "best_val_dice_posterior": best_scores["dice_posterior"],
        "train_time_min": round(elapsed_min, 2),
        "params_m": round(sum(p.numel() for p in model.parameters()) / 1e6, 3),
    }
    with (fold_dir / "eval_metrics.json").open("w", encoding="utf-8") as handle:
        json.dump(eval_metrics, handle, indent=2)

    return model, history, eval_metrics, elapsed_min
