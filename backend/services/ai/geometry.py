"""Volume orientation and mask resampling."""
from __future__ import annotations

from typing import Tuple

import numpy as np
from scipy.ndimage import zoom

__all__ = [
    "hwd_to_zyx",
    "resample_mask_to_shape",
    "zyx_to_hwd",
]


def zyx_to_hwd(volume: np.ndarray) -> np.ndarray:
    """Convert backend volume orientation (Z, Y, X) -> notebook style (H, W, D)."""
    return np.transpose(volume, (1, 2, 0))


def hwd_to_zyx(volume: np.ndarray) -> np.ndarray:
    """Convert notebook volume orientation (H, W, D) -> backend style (Z, Y, X)."""
    return np.transpose(volume, (2, 0, 1))


def resample_mask_to_shape(mask: np.ndarray, target_shape: Tuple[int, ...]) -> np.ndarray:
    mask = np.asarray(mask, dtype=np.uint8)
    if mask.shape == target_shape:
        return mask
    factors = tuple(t / s for t, s in zip(target_shape, mask.shape))
    resampled = zoom(mask.astype(np.float32), factors, order=0)
    return np.rint(resampled).astype(np.uint8)
