"""NIfTI upload helpers for GrayMatter hippocampus studies."""

from __future__ import annotations

import gzip
import shutil
from pathlib import Path

from fastapi import HTTPException, UploadFile

_NIFTI_SUFFIXES = (".nii", ".nii.gz")
_JUNK_UPLOAD_NAMES = frozenset({".ds_store", "thumbs.db", "desktop.ini"})
_JUNK_UPLOAD_PREFIXES = ("._",)


def _is_nifti_filename(name: str) -> bool:
    lower = name.lower()
    return lower.endswith((".nii.gz", ".nii"))


def _is_junk_upload_name(name: str) -> bool:
    """macOS/Windows metadata files that sometimes accompany real NIfTI uploads."""
    leaf = Path(name.replace("\\", "/")).name
    lower = leaf.lower()
    if lower in _JUNK_UPLOAD_NAMES:
        return True
    if lower.startswith("__macosx"):
        return True
    return any(lower.startswith(prefix) for prefix in _JUNK_UPLOAD_PREFIXES)


def _nifti_leaf_name(name: str) -> str:
    leaf = Path(name.replace("\\", "/")).name
    if _is_junk_upload_name(leaf):
        raise HTTPException(
            status_code=400,
            detail=(
                "That file is macOS metadata (._filename), not a real NIfTI scan. "
                "Select hippocampus_001.nii.gz without the leading ._ prefix."
            ),
        )
    return leaf


def _pick_nifti_upload(
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> UploadFile | None:
    parts = [
        f
        for f in (files or [])
        if f and (f.filename or "").strip() and not _is_junk_upload_name(f.filename or "")
    ]
    has_single = file is not None and bool((file.filename or "").strip())
    if has_single and _is_junk_upload_name(file.filename or ""):
        has_single = False
    if has_single and parts:
        raise HTTPException(
            status_code=400,
            detail="Provide either one NIfTI in `file` or a single item in `files`, not both.",
        )
    if has_single:
        return file
    if parts:
        return parts[0]
    # If only junk was uploaded, surface a clearer error than "no imaging data".
    junk_only = [
        f
        for f in (files or [])
        if f and (f.filename or "").strip() and _is_junk_upload_name(f.filename or "")
    ]
    if junk_only or (file and _is_junk_upload_name(file.filename or "")):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only macOS metadata files were uploaded (._*.nii.gz). "
                "Select the real .nii or .nii.gz volume, not AppleDouble sidecar files."
            ),
        )
    return None


def normalize_nifti_upload(
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> UploadFile:
    chosen = _pick_nifti_upload(file, files)
    if chosen is None:
        raise HTTPException(
            status_code=400,
            detail="No imaging data. Upload a hippocampus MRI (.nii or .nii.gz).",
        )
    parts = [
        f
        for f in (files or [])
        if f and (f.filename or "").strip() and not _is_junk_upload_name(f.filename or "")
    ]
    if len(parts) > 1:
        raise HTTPException(
            status_code=400,
            detail="Upload one NIfTI volume at a time (.nii or .nii.gz).",
        )
    name = (chosen.filename or "").lower()
    if not _is_nifti_filename(name):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Use .nii or .nii.gz (T1 hippocampus MRI).",
        )
    return chosen


def _validate_nifti_bytes(path: Path) -> None:
    """Reject empty files and obvious non-NIfTI payloads before MONAI load."""
    if not path.is_file() or path.stat().st_size < 16:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty or too small to be a valid NIfTI volume.",
        )
    lower = path.name.lower()
    if lower.endswith(".nii.gz"):
        try:
            with gzip.open(path, "rb") as gz:
                gz.read(16)
        except OSError as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{path.name} is not a valid gzip NIfTI file. "
                    "If you copied from macOS, avoid selecting ._ sidecar files."
                ),
            ) from exc


async def persist_nifti_upload(
    upload: UploadFile,
    dest_dir: Path,
) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    name = (upload.filename or "scan.nii.gz").replace("\\", "/")
    leaf = _nifti_leaf_name(name)
    if not _is_nifti_filename(leaf):
        leaf = "scan.nii.gz"
    dest = dest_dir / leaf
    with dest.open("wb") as out_f:
        shutil.copyfileobj(upload.file, out_f)
    _validate_nifti_bytes(dest)
    return dest
