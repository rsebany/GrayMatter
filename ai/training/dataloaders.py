"""Training dataloaders."""

from __future__ import annotations

import os
from typing import Any

import torch
from configs.experiment_config import ExperimentConfig
from monai.data import CacheDataset, Dataset, list_data_collate
from preprocessing.transforms import (
    get_deterministic_transforms,
    get_train_augmentations,
    get_val_transforms,
)
from torch.utils.data import DataLoader


class AugmentedDataset(Dataset):
    def __init__(self, base_dataset: Dataset, augmentations):
        self.base_dataset = base_dataset
        self.augmentations = augmentations

    def __len__(self) -> int:
        return len(self.base_dataset)

    def __getitem__(self, index: int):
        sample = self.base_dataset[index]
        return self.augmentations(sample)


def resolve_num_workers(config: ExperimentConfig) -> int:
    if config.num_workers >= 0:
        return config.num_workers
    env_override = os.environ.get("NUM_WORKERS")
    if env_override:
        return int(env_override)
    return 2 if torch.cuda.is_available() else 0


def create_dataloaders(
    train_cases: list[dict],
    val_cases: list[dict],
    config: ExperimentConfig,
) -> tuple[DataLoader, DataLoader]:
    nw = resolve_num_workers(config)
    train_base = CacheDataset(
        data=train_cases,
        transform=get_deterministic_transforms(config),
        cache_rate=1.0,
        num_workers=nw,
    )
    train_ds = AugmentedDataset(train_base, get_train_augmentations(config))
    val_ds = CacheDataset(
        data=val_cases,
        transform=get_val_transforms(config),
        cache_rate=1.0,
        num_workers=nw,
    )
    pin = torch.cuda.is_available()
    loader_kwargs: dict[str, Any] = {
        "num_workers": nw,
        "pin_memory": pin,
        "persistent_workers": nw > 0,
    }
    train_loader = DataLoader(
        train_ds,
        batch_size=config.batch_size,
        shuffle=True,
        collate_fn=list_data_collate,
        **loader_kwargs,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=1,
        shuffle=False,
        **loader_kwargs,
    )
    return train_loader, val_loader
