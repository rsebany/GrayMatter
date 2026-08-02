"""Prepare validated dataset copies without modifying raw source data."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from tqdm import tqdm

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from volume_io import validate_volume_pair  # noqa: E402
from utils import (  # noqa: E402
    VolumePair,
    ensure_dataset_layout,
    pair_images_and_labels,
    relative_to_root,
    resolve_dataset_paths,
    setup_logging,
    utc_timestamp,
    validate_required_directories,
    write_json,
)


def copy_valid_pair(
    pair: VolumePair,
    processed_images: Path,
    processed_labels: Path,
    use_symlinks: bool,
) -> tuple[Path, Path]:
    """Copy or symlink a valid image/label pair into processed directories."""
    processed_images.mkdir(parents=True, exist_ok=True)
    processed_labels.mkdir(parents=True, exist_ok=True)

    target_image = processed_images / pair.image_path.name
    target_label = processed_labels / pair.label_path.name

    if use_symlinks:
        if target_image.exists() or target_image.is_symlink():
            target_image.unlink()
        if target_label.exists() or target_label.is_symlink():
            target_label.unlink()
        target_image.symlink_to(pair.image_path)
        target_label.symlink_to(pair.label_path)
    else:
        shutil.copy2(pair.image_path, target_image)
        shutil.copy2(pair.label_path, target_label)

    return target_image, target_label


def run_preparation(
    dataset_root: Path | None = None,
    use_symlinks: bool = False,
    clean_processed: bool = False,
) -> int:
    """Validate raw pairs and materialize processed dataset organization."""
    paths = resolve_dataset_paths(dataset_root=dataset_root)
    logger = setup_logging("prepare_dataset")
    ensure_dataset_layout(paths, logger=logger)

    missing_dirs = validate_required_directories(paths)
    if missing_dirs:
        logger.error("Missing required directories: %s", missing_dirs)
        return 1

    if clean_processed and paths.processed_root.exists():
        shutil.rmtree(paths.processed_root)
        ensure_dataset_layout(paths, logger=logger)

    pairs, missing_labels, missing_images, duplicate_names = pair_images_and_labels(
        paths.raw_images,
        paths.raw_labels,
    )

    if missing_labels or missing_images or duplicate_names:
        logger.error(
            "Raw dataset failed pairing checks. Run verify_dataset.py first."
        )
        return 1

    valid_cases: list[dict] = []
    invalid_cases: list[dict] = []
    timestamp = utc_timestamp()

    for pair in tqdm(pairs, desc="Preparing dataset"):
        validation = validate_volume_pair(pair.image_path, pair.label_path)
        if not validation["is_valid"]:
            invalid_cases.append(
                {
                    "case_id": pair.case_id,
                    "patient_id": pair.patient_id,
                    "image_path": relative_to_root(pair.image_path, paths.project_root),
                    "label_path": relative_to_root(pair.label_path, paths.project_root),
                    "errors": validation["errors"],
                    "warnings": validation["warnings"],
                }
            )
            continue

        target_image, target_label = copy_valid_pair(
            pair,
            paths.processed_images,
            paths.processed_labels,
            use_symlinks=use_symlinks,
        )

        valid_cases.append(
            {
                "case_id": pair.case_id,
                "patient_id": pair.patient_id,
                "image": relative_to_root(target_image, paths.project_root),
                "label": relative_to_root(target_label, paths.project_root),
                "source_image": relative_to_root(pair.image_path, paths.project_root),
                "source_label": relative_to_root(pair.label_path, paths.project_root),
                "warnings": validation["warnings"],
            }
        )

    prepared_manifest = {
        "timestamp": timestamp,
        "strategy": "symlink" if use_symlinks else "copy",
        "num_valid_cases": len(valid_cases),
        "num_invalid_cases": len(invalid_cases),
        "cases": valid_cases,
    }
    write_json(paths.prepared_manifest, prepared_manifest)

    processing_report = {
        "timestamp": timestamp,
        "status": "pass" if valid_cases and not invalid_cases else ("partial" if valid_cases else "fail"),
        "valid_cases": len(valid_cases),
        "invalid_cases": len(invalid_cases),
        "invalid_case_details": invalid_cases,
    }
    write_json(paths.reports / "processing_report.json", processing_report)

    logger.info("Prepared %d valid case(s).", len(valid_cases))
    if invalid_cases:
        logger.warning("Skipped %d invalid case(s). See processing_report.json.", len(invalid_cases))
        return 1

    logger.info("Wrote prepared manifest to %s", paths.prepared_manifest)
    return 0


def build_arg_parser() -> argparse.ArgumentParser:
    """Build CLI argument parser."""
    parser = argparse.ArgumentParser(
        description="Prepare validated GRAYMATTER dataset copies under dataset/processed/.",
    )
    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=None,
        help="Optional override for local dataset root (default: <project>/dataset).",
    )
    parser.add_argument(
        "--symlink",
        action="store_true",
        help="Create symlinks instead of copying files into dataset/processed/.",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove existing dataset/processed/ before preparation.",
    )
    return parser


def main() -> int:
    """CLI entrypoint."""
    args = build_arg_parser().parse_args()
    return run_preparation(
        dataset_root=args.dataset_root,
        use_symlinks=args.symlink,
        clean_processed=args.clean,
    )


if __name__ == "__main__":
    raise SystemExit(main())
