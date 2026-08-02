"""On-disk segmentation revision manifests and mask payloads for sync routes."""
from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np


LABEL_CONTRACT: dict[str, int] = {
    "background": 0,
    "left": 1,
    "right": 2,
}

__all__ = [
    "LABEL_CONTRACT",
    "SegmentationRevision",
    "append_revision",
    "decode_mask",
    "load_manifest",
    "save_manifest",
]

# ---------------------------------------------------------------------------
# Revision model & manifest I/O
# ---------------------------------------------------------------------------


@dataclass
class SegmentationRevision:
    study_id: str
    revision_id: int
    source: str
    revision_note: str | None
    created_at: str
    shape_zyx: tuple[int, int, int]
    spacing_zyx_mm: tuple[float, float, float]
    orientation: str
    labels: dict[str, int]
    mask_path: Path


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _study_dir(root: Path, study_id: str) -> Path:
    return root / study_id


def _manifest_path(root: Path, study_id: str) -> Path:
    return _study_dir(root, study_id) / "manifest.json"


def load_manifest(root: Path, study_id: str) -> dict[str, Any]:
    path = _manifest_path(root, study_id)
    if not path.exists():
        return {"study_id": study_id, "current_revision_id": 0, "revisions": []}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_manifest(root: Path, study_id: str, payload: dict[str, Any]) -> None:
    study_dir = _study_dir(root, study_id)
    study_dir.mkdir(parents=True, exist_ok=True)
    with _manifest_path(root, study_id).open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


# ---------------------------------------------------------------------------
# Mask encode / decode & append revision
# ---------------------------------------------------------------------------


def decode_mask(mask_b64: str, shape_zyx: tuple[int, int, int]) -> np.ndarray:
    raw = base64.b64decode(mask_b64)
    expected = int(shape_zyx[0] * shape_zyx[1] * shape_zyx[2])
    if len(raw) != expected:
        raise ValueError(
            f"Mask payload size mismatch. Expected {expected} bytes for shape {shape_zyx}, got {len(raw)}."
        )
    return np.frombuffer(raw, dtype=np.uint8).reshape(shape_zyx)


def append_revision(
    root: Path,
    study_id: str,
    *,
    source: str,
    revision_note: str | None,
    shape_zyx: tuple[int, int, int],
    spacing_zyx_mm: tuple[float, float, float],
    orientation: str,
    labels: dict[str, int],
    mask: np.ndarray,
) -> SegmentationRevision:
    manifest = load_manifest(root, study_id)
    revision_id = int(manifest.get("current_revision_id", 0)) + 1
    study_dir = _study_dir(root, study_id)
    study_dir.mkdir(parents=True, exist_ok=True)
    mask_path = study_dir / f"mask_rev_{revision_id:04d}.npy"
    np.save(mask_path, mask.astype(np.uint8))
    created_at = now_iso()
    revision = {
        "revision_id": revision_id,
        "source": source,
        "revision_note": revision_note,
        "created_at": created_at,
        "geometry": {
            "shape_zyx": [int(v) for v in shape_zyx],
            "spacing_zyx_mm": [float(v) for v in spacing_zyx_mm],
            "orientation": orientation,
        },
        "labels": labels,
        "mask_path": str(mask_path),
    }
    manifest["current_revision_id"] = revision_id
    revisions = manifest.get("revisions", [])
    revisions.append(revision)
    manifest["revisions"] = revisions[-100:]
    save_manifest(root, study_id, manifest)
    return SegmentationRevision(
        study_id=study_id,
        revision_id=revision_id,
        source=source,
        revision_note=revision_note,
        created_at=created_at,
        shape_zyx=shape_zyx,
        spacing_zyx_mm=spacing_zyx_mm,
        orientation=orientation,
        labels=labels,
        mask_path=mask_path,
    )

