"""Shared utilities for the GRAYMATTER dataset preparation pipeline."""

from __future__ import annotations

import json
import logging
import shutil
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np
import pandas as pd

# Supported neuroimaging volume extensions (longest suffix first for matching).
SUPPORTED_EXTENSIONS: tuple[str, ...] = (
    ".nii.gz",
    ".nii",
    ".mha",
    ".mhd",
    ".nrrd",
)

DEFAULT_RANDOM_SEED = 42
DEFAULT_NUM_FOLDS = 5


@dataclass(frozen=True)
class DatasetPaths:
    """Canonical paths for the local dataset layout."""

    project_root: Path
    dataset_root: Path
    raw_root: Path
    raw_images: Path
    raw_labels: Path
    processed_root: Path
    processed_images: Path
    processed_labels: Path
    manifests: Path
    reports: Path
    prepared_manifest: Path
    dataset_readme: Path
    dataset_readme_template: Path


@dataclass
class VolumePair:
    """A matched image/label file pair."""

    case_id: str
    patient_id: str
    image_path: Path
    label_path: Path


@dataclass
class VerificationResult:
    """Structured output from dataset verification."""

    status: str
    timestamp: str
    project_root: str
    raw_images_dir: str
    raw_labels_dir: str
    total_images: int
    total_labels: int
    total_pairs: int
    missing_labels: list[str] = field(default_factory=list)
    missing_images: list[str] = field(default_factory=list)
    duplicate_image_names: list[str] = field(default_factory=list)
    duplicate_label_names: list[str] = field(default_factory=list)
    unsupported_files: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dictionary."""
        return asdict(self)


def find_project_root(start: Path | None = None) -> Path:
    """Locate the repository root by searching for marker directories."""
    current = (start or Path.cwd()).resolve()
    markers = {"ai", "backend", "frontend", "docs"}

    for candidate in [current, *current.parents]:
        if markers.issubset({child.name for child in candidate.iterdir() if child.is_dir()}):
            return candidate

    raise FileNotFoundError(
        "Could not locate GRAYMATTER project root. Run scripts from the repository root."
    )


def resolve_dataset_paths(
    project_root: Path | None = None,
    dataset_root: Path | None = None,
) -> DatasetPaths:
    """Build canonical dataset paths relative to the project root."""
    root = project_root or find_project_root()
    data_root = (dataset_root or (root / "dataset")).resolve()

    return DatasetPaths(
        project_root=root,
        dataset_root=data_root,
        raw_root=data_root / "raw",
        raw_images=data_root / "raw" / "images",
        raw_labels=data_root / "raw" / "labels",
        processed_root=data_root / "processed",
        processed_images=data_root / "processed" / "images",
        processed_labels=data_root / "processed" / "labels",
        manifests=data_root / "manifests",
        reports=data_root / "reports",
        prepared_manifest=data_root / "processed" / "prepared_cases.json",
        dataset_readme=data_root / "README.md",
        dataset_readme_template=root / "ai" / "datasets" / "templates" / "dataset_README.md",
    )


def setup_logging(name: str, level: int = logging.INFO) -> logging.Logger:
    """Configure and return a module logger."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False
    return logger


def utc_timestamp() -> str:
    """Return an ISO-8601 UTC timestamp."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dataset_layout(paths: DatasetPaths, logger: logging.Logger | None = None) -> None:
    """Create local dataset directories and seed README if missing."""
    for directory in (
        paths.raw_images,
        paths.raw_labels,
        paths.processed_images,
        paths.processed_labels,
        paths.manifests,
        paths.reports,
    ):
        directory.mkdir(parents=True, exist_ok=True)

    if not paths.dataset_readme.exists() and paths.dataset_readme_template.exists():
        shutil.copy2(paths.dataset_readme_template, paths.dataset_readme)
        if logger:
            logger.info("Created %s from template.", paths.dataset_readme)


def get_file_stem(path: Path) -> str:
    """Return filename stem, handling compound extensions such as .nii.gz."""
    for suffix in SUPPORTED_EXTENSIONS:
        if path.name.endswith(suffix):
            return path.name[: -len(suffix)]
    return path.stem


def is_supported_volume(path: Path) -> bool:
    """Return True if the file has a supported neuroimaging extension."""
    lower_name = path.name.lower()
    return any(lower_name.endswith(ext) for ext in SUPPORTED_EXTENSIONS)


def list_volume_files(directory: Path) -> list[Path]:
    """List supported volume files in a directory."""
    if not directory.exists():
        return []

    files = [
        path
        for path in directory.iterdir()
        if path.is_file() and is_supported_volume(path)
    ]
    return sorted(files, key=lambda item: item.name.lower())


# Dataset-style prefixes where the full stem is the unique subject/case ID.
DATASET_STYLE_PREFIXES: frozenset[str] = frozenset({"hippocampus"})


def extract_patient_id(filename: str) -> str:
    """
    Extract patient ID from a volume filename.

    For dataset-style names (e.g. hippocampus_001.nii.gz), the full stem is used
    as the unique subject ID. Otherwise, the prefix before the first underscore
    is used.
    """
    stem = get_file_stem(Path(filename))
    if "_" in stem:
        prefix, suffix = stem.split("_", 1)
        if prefix.lower() in DATASET_STYLE_PREFIXES and suffix:
            return stem
        return prefix
    return stem


def extract_case_id(filename: str) -> str:
    """Return the case identifier (full stem) for a volume filename."""
    return get_file_stem(Path(filename))


def pair_images_and_labels(
    image_dir: Path,
    label_dir: Path,
) -> tuple[list[VolumePair], list[str], list[str], list[str]]:
    """
    Pair image and label files by matching stems.

    Returns:
        pairs, missing_labels, missing_images, duplicate_names
    """
    images = list_volume_files(image_dir)
    labels = list_volume_files(label_dir)

    image_map: dict[str, Path] = {}
    label_map: dict[str, Path] = {}
    duplicate_names: list[str] = []

    for path in images:
        stem = get_file_stem(path)
        if stem in image_map:
            duplicate_names.append(path.name)
        image_map[stem] = path

    for path in labels:
        stem = get_file_stem(path)
        if stem in label_map:
            duplicate_names.append(path.name)
        label_map[stem] = path

    pairs: list[VolumePair] = []
    missing_labels: list[str] = []
    missing_images: list[str] = []

    for stem, image_path in sorted(image_map.items()):
        label_path = label_map.get(stem)
        if label_path is None:
            missing_labels.append(image_path.name)
            continue

        pairs.append(
            VolumePair(
                case_id=stem,
                patient_id=extract_patient_id(image_path.name),
                image_path=image_path.resolve(),
                label_path=label_path.resolve(),
            )
        )

    for stem, label_path in sorted(label_map.items()):
        if stem not in image_map:
            missing_images.append(label_path.name)

    return pairs, missing_labels, missing_images, sorted(set(duplicate_names))


def find_unsupported_files(directory: Path) -> list[str]:
    """Return non-hidden, non-supported files in a directory."""
    if not directory.exists():
        return []

    unsupported: list[str] = []
    for path in directory.iterdir():
        if not path.is_file():
            continue
        if path.name.startswith("."):
            continue
        if not is_supported_volume(path):
            unsupported.append(path.name)
    return sorted(unsupported)


def write_json(path: Path, payload: Any) -> None:
    """Write a JSON file with stable formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")


def read_json(path: Path) -> Any:
    """Read a JSON file."""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_dataframe_csv(path: Path, frame: pd.DataFrame) -> None:
    """Write a DataFrame to CSV without row indices."""
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def relative_to_root(path: Path, project_root: Path) -> str:
    """Return a project-root-relative POSIX path string."""
    return path.resolve().relative_to(project_root.resolve()).as_posix()


def paths_to_strings(paths: Iterable[Path], project_root: Path) -> list[str]:
    """Convert absolute paths to project-root-relative strings."""
    return [relative_to_root(path, project_root) for path in paths]


def affines_are_compatible(image_affine: np.ndarray, label_affine: np.ndarray, atol: float = 1e-3) -> bool:
    """Check whether image and label affines are numerically compatible."""
    return np.allclose(image_affine, label_affine, atol=atol)


def balance_patients_across_folds(
    patient_ids: Sequence[str],
    patient_case_counts: dict[str, int],
    num_folds: int,
    seed: int,
) -> list[list[str]]:
    """
    Assign patients to folds deterministically while balancing case counts.

    Uses a greedy assignment sorted by descending case count to approximate balance.
    """
    rng = np.random.default_rng(seed)
    ordered_patients = sorted(patient_ids, key=lambda pid: (-patient_case_counts[pid], pid))
    rng.shuffle(ordered_patients)

    # Greedy assignment by current fold load to approximate balance.
    fold_buckets: list[list[str]] = [[] for _ in range(num_folds)]
    fold_loads = [0 for _ in range(num_folds)]

    for patient_id in ordered_patients:
        target_fold = min(
            range(num_folds),
            key=lambda idx: (fold_loads[idx], len(fold_buckets[idx]), idx),
        )
        fold_buckets[target_fold].append(patient_id)
        fold_loads[target_fold] += patient_case_counts[patient_id]

    return fold_buckets


def validate_required_directories(paths: DatasetPaths) -> list[str]:
    """Return a list of missing required raw directories."""
    missing: list[str] = []
    if not paths.raw_images.exists():
        missing.append(str(paths.raw_images))
    if not paths.raw_labels.exists():
        missing.append(str(paths.raw_labels))
    return missing
