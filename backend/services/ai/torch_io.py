"""PyTorch checkpoint loading compatible with PyTorch 2.6+ (``weights_only`` default)."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Union

import torch

PathLike = Union[str, Path]


def load_torch_checkpoint(path: PathLike, *, map_location: Any = None) -> Any:
    """
    Load a ``.pth`` checkpoint (typically a ``state_dict`` or nested dict).

    PyTorch 2.6+ defaults ``torch.load(..., weights_only=True)``, which rejects many
    legitimate training checkpoints. We load trusted local weights with
    ``weights_only=False`` when supported, and fall back for older torch versions.
    """
    p = str(path)
    try:
        return torch.load(p, map_location=map_location, weights_only=False)
    except TypeError:
        return torch.load(p, map_location=map_location)


__all__ = ["load_torch_checkpoint"]
