"""Create deterministic patient-wise cross-validation fold manifests."""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from utils import (  # noqa: E402
    DEFAULT_NUM_FOLDS,
    DEFAULT_RANDOM_SEED,
    balance_patients_across_folds,
    ensure_dataset_layout,
    read_json,
    resolve_dataset_paths,
    setup_logging,
    utc_timestamp,
    write_dataframe_csv,
    write_json,
)


def group_cases_by_patient(cases: list[dict]) -> dict[str, list[dict]]:
    """Group prepared cases by patient ID."""
    grouped: dict[str, list[dict]] = defaultdict(list)
    for case in cases:
        grouped[case["patient_id"]].append(case)
    return dict(grouped)


def build_fold_manifest(
    fold_index: int,
    validation_patients: list[str],
    grouped_cases: dict[str, list[dict]],
    seed: int,
) -> dict:
    """Build one fold manifest with training and validation partitions."""
    validation_set = set(validation_patients)
    training_patients = sorted(pid for pid in grouped_cases if pid not in validation_set)

    def collect_cases(patient_ids: list[str]) -> list[dict]:
        cases: list[dict] = []
        for patient_id in sorted(patient_ids):
            for case in sorted(grouped_cases[patient_id], key=lambda item: item["case_id"]):
                cases.append(
                    {
                        "case_id": case["case_id"],
                        "patient_id": case["patient_id"],
                        "image": case["image"],
                        "label": case["label"],
                    }
                )
        return cases

    return {
        "fold": fold_index,
        "seed": seed,
        "training": {
            "patient_ids": training_patients,
            "cases": collect_cases(training_patients),
        },
        "validation": {
            "patient_ids": sorted(validation_patients),
            "cases": collect_cases(sorted(validation_patients)),
        },
    }


def run_fold_creation(
    dataset_root: Path | None = None,
    num_folds: int = DEFAULT_NUM_FOLDS,
    seed: int = DEFAULT_RANDOM_SEED,
) -> int:
    """Generate patient-wise k-fold manifests from prepared cases."""
    paths = resolve_dataset_paths(dataset_root=dataset_root)
    logger = setup_logging("create_folds")
    ensure_dataset_layout(paths, logger=logger)

    if not paths.prepared_manifest.exists():
        logger.error(
            "Prepared manifest not found at %s. Run prepare_dataset.py first.",
            paths.prepared_manifest,
        )
        return 1

    prepared = read_json(paths.prepared_manifest)
    cases: list[dict] = prepared.get("cases", [])
    if not cases:
        logger.error("No valid prepared cases available for fold generation.")
        return 1

    grouped_cases = group_cases_by_patient(cases)
    patient_ids = sorted(grouped_cases.keys())
    patient_case_counts = {pid: len(grouped_cases[pid]) for pid in patient_ids}

    if len(patient_ids) < num_folds:
        logger.error(
            "Need at least %d unique patients for %d folds; found %d.",
            num_folds,
            num_folds,
            len(patient_ids),
        )
        return 1

    fold_patient_buckets = balance_patients_across_folds(
        patient_ids=patient_ids,
        patient_case_counts=patient_case_counts,
        num_folds=num_folds,
        seed=seed,
    )

    timestamp = utc_timestamp()
    fold_stats_rows: list[dict] = []

    for fold_idx, validation_patients in enumerate(fold_patient_buckets, start=1):
        manifest = build_fold_manifest(
            fold_index=fold_idx,
            validation_patients=validation_patients,
            grouped_cases=grouped_cases,
            seed=seed,
        )
        manifest["timestamp"] = timestamp
        output_path = paths.manifests / f"fold{fold_idx}.json"
        write_json(output_path, manifest)

        fold_stats_rows.append(
            {
                "fold": fold_idx,
                "seed": seed,
                "num_training_patients": len(manifest["training"]["patient_ids"]),
                "num_validation_patients": len(manifest["validation"]["patient_ids"]),
                "num_training_cases": len(manifest["training"]["cases"]),
                "num_validation_cases": len(manifest["validation"]["cases"]),
            }
        )
        logger.info(
            "Wrote fold %d: %d train / %d val cases.",
            fold_idx,
            len(manifest["training"]["cases"]),
            len(manifest["validation"]["cases"]),
        )

    write_dataframe_csv(paths.reports / "fold_statistics.csv", pd.DataFrame(fold_stats_rows))
    logger.info("Wrote fold statistics to %s", paths.reports / "fold_statistics.csv")
    return 0


def build_arg_parser() -> argparse.ArgumentParser:
    """Build CLI argument parser."""
    parser = argparse.ArgumentParser(
        description="Create deterministic patient-wise cross-validation fold manifests.",
    )
    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=None,
        help="Optional override for local dataset root (default: <project>/dataset).",
    )
    parser.add_argument(
        "--folds",
        type=int,
        default=DEFAULT_NUM_FOLDS,
        help=f"Number of folds (default: {DEFAULT_NUM_FOLDS}).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_RANDOM_SEED,
        help=f"Random seed for deterministic assignment (default: {DEFAULT_RANDOM_SEED}).",
    )
    return parser


def main() -> int:
    """CLI entrypoint."""
    args = build_arg_parser().parse_args()
    return run_fold_creation(
        dataset_root=args.dataset_root,
        num_folds=args.folds,
        seed=args.seed,
    )


if __name__ == "__main__":
    raise SystemExit(main())
