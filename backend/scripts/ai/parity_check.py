#!/usr/bin/env python3
"""Compare backend inference mask vs a reference mask."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.bootstrap import ensure_backend_api_on_path
from common.mask_compare import (
    evaluate_dice_thresholds,
    load_reference_mask,
    mask_comparison_summary,
    parse_class_dice_thresholds,
    resample_mask_to_shape,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Parity check: backend inference mask vs reference mask."
    )
    parser.add_argument("--dicom-dir", required=True, help="Directory containing DICOM slices.")
    parser.add_argument("--weights", required=True, help="Path to .pth model weights.")
    parser.add_argument(
        "--reference-mask",
        required=True,
        help="Path to reference mask (.npy or .npz).",
    )
    parser.add_argument(
        "--out-json",
        default="",
        help="Optional output file for JSON report.",
    )
    parser.add_argument(
        "--min-lesion-dice",
        type=float,
        default=None,
        help="Optional minimum lesion Dice. Exits non-zero if unmet.",
    )
    parser.add_argument(
        "--min-class-dice",
        default="",
        help="Optional per-class minimum Dice, e.g. '1:0.80,2:0.75,3:0.75'.",
    )
    args = parser.parse_args()

    ensure_backend_api_on_path()
    from services.ai.inference import process_dicom_zip_dir

    dicom_dir = Path(args.dicom_dir).resolve()
    weights_path = Path(args.weights).resolve()
    ref_path = Path(args.reference_mask).resolve()

    pred_mask, _spacing, _volume_hu, _lung_mask = process_dicom_zip_dir(
        dicom_dir, weights_path
    )
    pred_mask = np.asarray(pred_mask, dtype=np.uint8)
    ref_mask = load_reference_mask(ref_path)

    if pred_mask.shape != ref_mask.shape:
        ref_mask = resample_mask_to_shape(ref_mask, pred_mask.shape)

    report = mask_comparison_summary(pred_mask, ref_mask)
    text = json.dumps(report, indent=2)
    print(text)

    if args.out_json:
        out_path = Path(args.out_json).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text, encoding="utf-8")
        print(f"\nSaved report to: {out_path}")

    if args.min_lesion_dice is not None and not (0.0 <= args.min_lesion_dice <= 1.0):
        raise ValueError("--min-lesion-dice must be in [0,1]")

    min_class_dice = parse_class_dice_thresholds(args.min_class_dice)
    passed, failures = evaluate_dice_thresholds(
        report,
        min_lesion_dice=args.min_lesion_dice,
        min_class_dice=min_class_dice,
    )
    if passed:
        if args.min_lesion_dice is not None or min_class_dice:
            print("Threshold checks: PASS")
        return 0

    print("\nThreshold checks: FAIL")
    for msg in failures:
        print(f"- {msg}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
