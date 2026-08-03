#!/usr/bin/env python3
"""Run backend inference regression checks on one DICOM series."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.bootstrap import ensure_backend_api_on_path
from common.paths import DEFAULT_WEIGHTS_PATH


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run backend inference regression checks on one DICOM series."
    )
    parser.add_argument(
        "--dicom-dir",
        required=False,
        help="Path to a folder containing one DICOM series (.dcm/.dicom files).",
    )
    parser.add_argument(
        "--weights",
        default=None,
        help=f"Optional weights path (default: {DEFAULT_WEIGHTS_PATH}).",
    )
    parser.add_argument(
        "--min-volume-ml",
        type=float,
        default=0.0,
        help="Minimum accepted hippocampus volume in ml (default: 0.0).",
    )
    parser.add_argument(
        "--max-volume-ml",
        type=float,
        default=50.0,
        help="Maximum accepted hippocampus volume in ml (default: 50.0).",
    )
    parser.add_argument(
        "--allow-empty-mask",
        action="store_true",
        help="Do not fail when predicted mask is empty.",
    )
    parser.add_argument(
        "--check-native-remap",
        action="store_true",
        help="Run synthetic regression for mask embed path.",
    )
    parser.add_argument(
        "--remap-only",
        action="store_true",
        help="Run only the synthetic remap regression and skip full model inference.",
    )
    return parser.parse_args()


def run_native_remap_regression() -> None:
    from services.ai.geometry import resample_mask_to_shape

    src_shape = (48, 64, 48)
    tgt_shape = (100, 120, 110)

    synthetic_mask = np.zeros(src_shape, dtype=np.uint8)
    synthetic_mask[10:30, 20:40, 10:30] = 1
    synthetic_mask[12:28, 25:45, 20:38] = 2

    remapped = resample_mask_to_shape(synthetic_mask, tgt_shape)
    labels = set(np.unique(remapped).tolist())

    if remapped.shape != tgt_shape:
        raise SystemExit(
            f"[FAIL] Remapped mask has unexpected shape {remapped.shape}, expected {tgt_shape}"
        )
    if remapped.dtype != np.uint8:
        raise SystemExit(f"[FAIL] Remapped mask has unexpected dtype {remapped.dtype}")
    if not labels.issubset({0, 1, 2}):
        raise SystemExit(f"[FAIL] Remapped mask has unexpected labels: {sorted(labels)}")
    if int((remapped > 0).sum()) <= 0:
        raise SystemExit("[FAIL] Remapped mask is unexpectedly empty.")

    print(
        "[PASS] Native remap regression passed: "
        f"{src_shape} -> {tgt_shape}, labels={sorted(labels)}"
    )


def main() -> int:
    args = parse_args()
    ensure_backend_api_on_path()

    from services.ai.inference import (
        compute_hippocampus_volume_ml,
        process_dicom_zip_dir,
    )

    if args.check_native_remap:
        run_native_remap_regression()
        if args.remap_only:
            return 0

    if not args.dicom_dir:
        raise SystemExit(
            "[FAIL] --dicom-dir is required unless --check-native-remap --remap-only is used."
        )

    dicom_dir = Path(args.dicom_dir).resolve()
    if not dicom_dir.is_dir():
        raise SystemExit(f"[FAIL] Invalid --dicom-dir: {dicom_dir}")

    weights_path = Path(args.weights).resolve() if args.weights else DEFAULT_WEIGHTS_PATH
    if not weights_path.is_file():
        raise SystemExit(f"[FAIL] Weights not found: {weights_path}")

    print(f"[INFO] DICOM dir: {dicom_dir}")
    print(f"[INFO] Weights:   {weights_path}")

    mask, spacing, _volume, _lung_mask = process_dicom_zip_dir(dicom_dir, weights_path)
    volume_ml = compute_hippocampus_volume_ml(mask, spacing)
    nonzero_voxels = int((mask > 0).sum())

    print(f"[INFO] Mask shape: {tuple(mask.shape)}")
    print(f"[INFO] Spacing:    {spacing}")
    print(f"[INFO] Voxels>0:   {nonzero_voxels}")
    print(f"[INFO] Hippocampus ml: {volume_ml:.4f}")

    if len(spacing) != 3:
        raise SystemExit(f"[FAIL] Invalid spacing tuple: {spacing}")
    if any(s <= 0 for s in spacing):
        raise SystemExit(f"[FAIL] Non-positive spacing values: {spacing}")

    if not args.allow_empty_mask and nonzero_voxels == 0:
        raise SystemExit("[FAIL] Predicted mask is empty.")

    if not (args.min_volume_ml <= volume_ml <= args.max_volume_ml):
        raise SystemExit(
            f"[FAIL] Volume {volume_ml:.4f} ml outside expected range "
            f"[{args.min_volume_ml}, {args.max_volume_ml}]"
        )

    print("[PASS] Inference regression checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
