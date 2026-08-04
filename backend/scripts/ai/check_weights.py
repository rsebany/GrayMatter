#!/usr/bin/env python3
"""Sanity-check the production Hybrid Attention U-Net checkpoint and a forward pass."""
from __future__ import annotations

import sys
from pathlib import Path

import torch

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.paths import BACKEND_API_DIR, PLATFORM_ROOT

_AI_ROOT = PLATFORM_ROOT / "ai"


def main() -> int:
    """
    Sanity-check for the production ``LightweightHybridAttentionUNet3D`` checkpoint.

    - Verifies weights file exists (env ``GRAYMATTER_CHECKPOINT`` or
      ``ai/checkpoints/model.pt``).
    - Builds the model from ``ai/configs/hybrid_attention_v1.json`` via
      ``models.hybrid_attention_unet.build_model`` (same as inference).
    - Reports missing / unexpected keys.
    - Runs a random 1-channel forward pass.
    """
    if str(BACKEND_API_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_API_DIR))
    from config import WEIGHTS_PATH

    if not WEIGHTS_PATH.is_file():
        print(f"[ERROR] Weights file not found at {WEIGHTS_PATH}")
        return 1

    if str(_AI_ROOT) not in sys.path:
        sys.path.insert(0, str(_AI_ROOT))
    try:
        from configs.experiment_config import load_experiment_config
        from models.hybrid_attention_unet import build_model
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Failed to import ai modules from {_AI_ROOT}: {exc}")
        return 1

    config_path = _AI_ROOT / "configs" / "hybrid_attention_v1.json"
    config = load_experiment_config(config_path)
    print(f"[INFO] Using weights: {WEIGHTS_PATH}")
    print(
        f"[INFO] skip_mode={config.skip_mode}, classes={config.num_classes}, "
        f"channels={config.model_channels}, roi={config.roi_size}"
    )

    device = torch.device("cpu")
    model = build_model(config).to(device)
    model.eval()

    checkpoint = torch.load(WEIGHTS_PATH, map_location=device, weights_only=False)
    state_dict = checkpoint.get(
        "model_state_dict", checkpoint.get("state_dict", checkpoint)
    )
    print(f"[INFO] Checkpoint top-level keys: {list(checkpoint.keys())}")
    print(f"[INFO] state_dict entries: {len(state_dict)}")

    load_result = model.load_state_dict(state_dict, strict=False)
    print(f"[INFO] Missing keys count: {len(load_result.missing_keys)}")
    for key in load_result.missing_keys:
        print(f"  MISSING: {key}")
    print(f"[INFO] Unexpected keys count: {len(load_result.unexpected_keys)}")
    for key in load_result.unexpected_keys:
        print(f"  UNEXPECTED: {key}")
    if load_result.missing_keys or load_result.unexpected_keys:
        print("[ERROR] Checkpoint does not exactly match the model; inference would be wrong.")
        return 1

    dz, dy, dx = config.roi_size
    x = torch.randn(1, 1, dz, dy, dx)
    with torch.no_grad():
        y = model(x)

    print(f"[OK] Forward pass OK. Output shape: {tuple(y.shape)}")
    print(f"[INFO] Output stats: min={float(y.min()):.4f}, max={float(y.max()):.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
