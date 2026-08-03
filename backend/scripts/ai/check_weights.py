#!/usr/bin/env python3
"""Sanity-check UNet3D checkpoint loading and a single forward pass."""
from __future__ import annotations

import sys
from pathlib import Path

import torch

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.bootstrap import ensure_backend_ai_on_path
from common.paths import BACKEND_AI_DIR, DEFAULT_WEIGHTS_PATH


def main() -> int:
    """
    Quick sanity-check for the production UNet3DResidual checkpoint.

    - Verifies weights file exists.
    - Loads via ``train_pipeline.load_trained_model`` (same as inference).
    - Reports missing / unexpected keys (with production key remap).
    - Runs a random 2-channel forward pass.
    """
    if not BACKEND_AI_DIR.is_dir():
        print(f"[ERROR] backend-ai directory not found at {BACKEND_AI_DIR}")
        return 1

    if not DEFAULT_WEIGHTS_PATH.is_file():
        print(f"[ERROR] Weights file not found at {DEFAULT_WEIGHTS_PATH}")
        return 1

    ensure_backend_ai_on_path()
    try:
        from config import IN_CHANNELS, PATCH_SIZE  # type: ignore
        from models.unet3d import UNet3DResidual  # type: ignore
        from train_pipeline import (  # type: ignore
            _extract_state_dict,
            _load_checkpoint_raw,
            _strip_deep_supervision_keys,
            load_trained_model,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Failed to import backend-ai modules: {exc}")
        return 1

    print(f"[INFO] Using weights: {DEFAULT_WEIGHTS_PATH}")
    print(f"[INFO] Model in_channels={IN_CHANNELS}, patch_size={PATCH_SIZE}")

    device = torch.device("cpu")
    raw = _strip_deep_supervision_keys(
        _extract_state_dict(_load_checkpoint_raw(DEFAULT_WEIGHTS_PATH, device))
    )
    remapped = {
        k.replace("module.", "").replace("final_conv.", "final."): v for k, v in raw.items()
    }
    probe = UNet3DResidual(in_channels=IN_CHANNELS, num_classes=4)
    load_result = probe.load_state_dict(remapped, strict=False)
    print(f"[INFO] Missing keys count: {len(load_result.missing_keys)}")
    for key in load_result.missing_keys:
        print(f"  MISSING: {key}")
    print(f"[INFO] Unexpected keys count: {len(load_result.unexpected_keys)}")
    for key in load_result.unexpected_keys:
        print(f"  UNEXPECTED: {key}")

    model = load_trained_model(DEFAULT_WEIGHTS_PATH, device)
    dz, dy, dx = PATCH_SIZE
    x = torch.randn(1, IN_CHANNELS, dz, dy, dx)
    with torch.no_grad():
        y = model(x)

    print(f"[INFO] Forward pass OK. Output shape: {tuple(y.shape)}")
    print(f"[INFO] Output stats: min={float(y.min()):.4f}, max={float(y.max()):.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
