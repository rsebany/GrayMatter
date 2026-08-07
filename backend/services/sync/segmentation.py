"""On-disk segmentation revision manifests and mask payloads for sync routes."""
from __future__ import annotations

import base64
import binascii
import json
import os
import tempfile
import threading
import re
from contextlib import contextmanager
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
    "accept_revision",
    "append_revision",
    "atomic_save_mask",
    "begin_revision",
    "decode_mask",
    "fail_revision",
    "get_revision",
    "load_manifest",
    "revision_lock",
    "resolve_revision_mask_path",
    "validate_study_id",
    "save_manifest",
    "validate_mask_values",
]

REVISION_STATUSES = frozenset({"pending", "accepted", "failed"})
_manifest_locks: dict[str, threading.RLock] = {}
_manifest_locks_guard = threading.Lock()
_STUDY_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_DEFAULT_REVISION_RETENTION = 100

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
    status: str = "pending"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_study_id(study_id: str) -> str:
    if not _STUDY_ID_RE.fullmatch(study_id):
        raise ValueError("Invalid study identifier.")
    return study_id


def _study_dir(root: Path, study_id: str) -> Path:
    validate_study_id(study_id)
    root_resolved = root.resolve()
    candidate = (root_resolved / study_id).resolve()
    try:
        candidate.relative_to(root_resolved)
    except ValueError as exc:
        raise ValueError("Study storage path escapes the configured root.") from exc
    return candidate


def _manifest_path(root: Path, study_id: str) -> Path:
    return _study_dir(root, study_id) / "manifest.json"


def _manifest_lock(study_id: str) -> threading.RLock:
    if not _STUDY_ID_RE.fullmatch(study_id):
        raise ValueError("Invalid study identifier.")
    with _manifest_locks_guard:
        return _manifest_locks.setdefault(study_id, threading.RLock())


@contextmanager
def revision_lock(study_id: str, root: Path | None = None):
    """Serialize one study in-process and, when rooted, across API workers."""
    with _manifest_lock(study_id):
        if root is None:
            yield
            return
        study_dir = _study_dir(root, study_id)
        study_dir.mkdir(parents=True, exist_ok=True)
        lock_path = study_dir / ".revision.lock"
        with lock_path.open("a+b") as lock_file:
            lock_file.seek(0, os.SEEK_END)
            if lock_file.tell() == 0:
                lock_file.write(b"\0")
                lock_file.flush()
            lock_file.seek(0)
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
                try:
                    yield
                finally:
                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _empty_manifest(study_id: str) -> dict[str, Any]:
    return {
        "study_id": study_id,
        "current_revision_id": 0,
        "next_revision_id": 1,
        "revisions": [],
    }


def load_manifest(root: Path, study_id: str) -> dict[str, Any]:
    path = _manifest_path(root, study_id)
    if not path.exists():
        return _empty_manifest(study_id)
    with path.open("r", encoding="utf-8") as f:
        manifest = json.load(f)
    if not isinstance(manifest, dict) or manifest.get("study_id") != study_id:
        raise ValueError("Revision manifest study identifier is invalid.")
    if not isinstance(manifest.get("revisions", []), list):
        raise ValueError("Revision manifest revisions must be a list.")
    # Older manifests predate lifecycle statuses. They represent accepted revisions.
    for revision in manifest.get("revisions", []):
        revision.setdefault("status", "accepted")
        revision.setdefault("accepted_at", revision.get("created_at"))
    highest = max(
        (int(item.get("revision_id", 0)) for item in manifest.get("revisions", [])),
        default=0,
    )
    manifest.setdefault("next_revision_id", highest + 1)
    return manifest


def save_manifest(root: Path, study_id: str, payload: dict[str, Any]) -> None:
    if payload.get("study_id") != study_id:
        raise ValueError("Cannot write a manifest for a different study.")
    study_dir = _study_dir(root, study_id)
    study_dir.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        dir=study_dir, prefix=".manifest.", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temporary_name, _manifest_path(root, study_id))
        _fsync_directory(study_dir)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def atomic_save_mask(path: Path, mask: np.ndarray) -> None:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "wb") as f:
            np.save(f, mask.astype(np.uint8, copy=False), allow_pickle=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temporary_name, path)
        _fsync_directory(path.parent)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def _fsync_directory(directory: Path) -> None:
    """Best-effort directory durability after an atomic rename."""
    if os.name == "nt":
        return
    try:
        descriptor = os.open(directory, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _revision_retention() -> int:
    raw = os.environ.get("GRAYMATTER_SEGMENTATION_REVISION_RETENTION", "")
    try:
        return max(2, min(10_000, int(raw or _DEFAULT_REVISION_RETENTION)))
    except ValueError:
        return _DEFAULT_REVISION_RETENTION


def _prune_revisions(
    root: Path,
    study_id: str,
    manifest: dict[str, Any],
) -> list[Path]:
    revisions = list(manifest.get("revisions", []))
    limit = _revision_retention()
    if len(revisions) <= limit:
        return []
    current_id = int(manifest.get("current_revision_id", 0))
    keep_ids = {
        int(item.get("revision_id", 0))
        for item in revisions[-limit:]
    }
    if current_id:
        keep_ids.add(current_id)
    kept = [
        item for item in revisions if int(item.get("revision_id", 0)) in keep_ids
    ]
    removed = [
        item for item in revisions if int(item.get("revision_id", 0)) not in keep_ids
    ]
    study_dir = _study_dir(root, study_id)
    removable_paths: list[Path] = []
    for item in removed:
        mask_path = Path(str(item.get("mask_path", ""))).resolve()
        try:
            mask_path.relative_to(study_dir)
        except ValueError:
            continue
        if mask_path.name.startswith("mask_rev_"):
            removable_paths.append(mask_path)
    manifest["revisions"] = kept
    return removable_paths


# ---------------------------------------------------------------------------
# Mask encode / decode & append revision
# ---------------------------------------------------------------------------


def decode_mask(mask_b64: str, shape_zyx: tuple[int, int, int]) -> np.ndarray:
    try:
        raw = base64.b64decode(mask_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Mask payload is not valid base64.") from exc
    expected = int(shape_zyx[0] * shape_zyx[1] * shape_zyx[2])
    if len(raw) != expected:
        raise ValueError(
            f"Mask payload size mismatch. Expected {expected} bytes for shape {shape_zyx}, got {len(raw)}."
        )
    mask = np.frombuffer(raw, dtype=np.uint8).reshape(shape_zyx)
    validate_mask_values(mask)
    return mask


def validate_mask_values(mask: np.ndarray) -> None:
    values = np.unique(np.asarray(mask))
    invalid = [int(value) for value in values if int(value) not in LABEL_CONTRACT.values()]
    if invalid:
        raise ValueError(
            f"Mask contains unsupported label values {invalid}; allowed values are [0, 1, 2]."
        )


def get_revision(manifest: dict[str, Any], revision_id: int) -> dict[str, Any] | None:
    return next(
        (
            item
            for item in manifest.get("revisions", [])
            if int(item.get("revision_id", 0)) == int(revision_id)
        ),
        None,
    )


def resolve_revision_mask_path(
    root: Path,
    study_id: str,
    value: str | Path,
) -> Path:
    """Resolve a manifest mask path and reject traversal or symlink escapes."""
    study_dir = _study_dir(root, study_id)
    path = Path(value).resolve()
    try:
        path.relative_to(study_dir)
    except ValueError as exc:
        raise ValueError("Revision mask path escapes study storage.") from exc
    if not path.name.startswith("mask_rev_") or path.suffix != ".npy":
        raise ValueError("Revision mask filename is invalid.")
    return path


def begin_revision(
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
    user_id: str | None = None,
    module_name: str | None = None,
    module_version: str | None = None,
    workstation_id: str | None = None,
    rollback_of_revision_id: int | None = None,
) -> SegmentationRevision:
    validate_mask_values(mask)
    with _manifest_lock(study_id):
        manifest = load_manifest(root, study_id)
        revision_id = int(manifest.get("next_revision_id", 1))
        study_dir = _study_dir(root, study_id)
        mask_path = (study_dir / f"mask_rev_{revision_id:04d}.npy").resolve()
        atomic_save_mask(mask_path, mask)
        created_at = now_iso()
        revision = {
            "revision_id": revision_id,
            "source": source,
            "revision_note": revision_note,
            "created_at": created_at,
            "updated_at": created_at,
            "status": "pending",
            "failure_reason": None,
            "authenticated_user_id": user_id,
            "module_name": module_name,
            "module_version": module_version,
            "workstation_id": workstation_id,
            "rollback_of_revision_id": rollback_of_revision_id,
            "geometry": {
                "shape_zyx": [int(v) for v in shape_zyx],
                "spacing_zyx_mm": [float(v) for v in spacing_zyx_mm],
                "orientation": orientation,
            },
            "labels": dict(labels),
            "mask_path": str(mask_path),
        }
        manifest["next_revision_id"] = revision_id + 1
        revisions = manifest.get("revisions", [])
        revisions.append(revision)
        manifest["revisions"] = revisions
        pruned_mask_paths = _prune_revisions(root, study_id, manifest)
        save_manifest(root, study_id, manifest)
        for pruned_path in pruned_mask_paths:
            pruned_path.unlink(missing_ok=True)
    return SegmentationRevision(
        study_id=study_id,
        revision_id=revision_id,
        source=source,
        revision_note=revision_note,
        created_at=created_at,
        shape_zyx=shape_zyx,
        spacing_zyx_mm=spacing_zyx_mm,
        orientation=orientation,
        labels=dict(labels),
        mask_path=mask_path,
        status="pending",
    )


def _transition_revision(
    root: Path,
    study_id: str,
    revision_id: int,
    *,
    status: str,
    failure_reason: str | None = None,
    mesh_url: str | None = None,
    stl_url: str | None = None,
) -> dict[str, Any]:
    if status not in REVISION_STATUSES:
        raise ValueError(f"Unsupported revision status: {status}")
    with _manifest_lock(study_id):
        manifest = load_manifest(root, study_id)
        revision = get_revision(manifest, revision_id)
        if revision is None:
            raise KeyError(f"Revision {revision_id} not found")
        if revision.get("status") != "pending":
            raise ValueError(
                f"Revision {revision_id} cannot transition from {revision.get('status')} to {status}."
            )
        timestamp = now_iso()
        revision["status"] = status
        revision["updated_at"] = timestamp
        revision["failure_reason"] = failure_reason
        if status == "accepted":
            revision["accepted_at"] = timestamp
            revision["mesh_url"] = mesh_url
            revision["stl_url"] = stl_url
            manifest["current_revision_id"] = revision_id
        elif status == "failed":
            revision["failed_at"] = timestamp
        save_manifest(root, study_id, manifest)
        return dict(revision)


def accept_revision(
    root: Path,
    study_id: str,
    revision_id: int,
    *,
    mesh_url: str | None,
    stl_url: str | None,
) -> dict[str, Any]:
    return _transition_revision(
        root,
        study_id,
        revision_id,
        status="accepted",
        mesh_url=mesh_url,
        stl_url=stl_url,
    )


def fail_revision(
    root: Path,
    study_id: str,
    revision_id: int,
    failure_reason: str,
) -> dict[str, Any]:
    return _transition_revision(
        root,
        study_id,
        revision_id,
        status="failed",
        failure_reason="Revision processing failed.",
    )


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
    """Backward-compatible immediate append for trusted internal callers."""
    revision = begin_revision(
        root,
        study_id,
        source=source,
        revision_note=revision_note,
        shape_zyx=shape_zyx,
        spacing_zyx_mm=spacing_zyx_mm,
        orientation=orientation,
        labels=labels,
        mask=mask,
    )
    accept_revision(root, study_id, revision.revision_id, mesh_url=None, stl_url=None)
    revision.status = "accepted"
    return revision

