"""Training loss builders."""

from __future__ import annotations

from typing import Sequence

import torch
from monai.losses import DiceCELoss

from configs.experiment_config import ExperimentConfig


def compute_inverse_frequency_ce_weights(
    counts: Sequence[int],
    foreground_boost: float = 1.0,
) -> torch.Tensor:
    counts_t = torch.tensor(counts, dtype=torch.float32)
    inv_freq = 1.0 / counts_t
    weights = inv_freq / inv_freq.sum() * len(counts)
    if foreground_boost != 1.0 and len(weights) > 1:
        weights = weights.clone()
        weights[1:] *= foreground_boost
        weights = weights / weights.sum() * len(counts)
    return weights


def build_loss_fn(config: ExperimentConfig, device: torch.device) -> DiceCELoss:
    weights = compute_inverse_frequency_ce_weights(
        config.class_voxel_counts,
        foreground_boost=config.foreground_ce_boost,
    )
    return DiceCELoss(
        include_background=False,
        to_onehot_y=True,
        softmax=True,
        squared_pred=config.loss_squared_pred,
        weight=weights.to(device),
        lambda_dice=config.lambda_dice,
        lambda_ce=config.lambda_ce,
    )
