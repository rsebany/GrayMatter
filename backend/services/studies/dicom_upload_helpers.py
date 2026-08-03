"""DICOM upload helpers for study intake."""

from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

from fastapi import HTTPException, UploadFile

_DICOM_SUFFIXES = (".dcm", ".dicom")
_NIFTI_SUFFIXES = (".nii", ".nii.gz")


def _is_dicom_filename(name: str) -> bool:
    lower = name.lower()
    return lower.endswith(_DICOM_SUFFIXES)


def _is_nifti_filename(name: str) -> bool:
    lower = name.lower()
    return lower.endswith((".nii.gz", ".nii"))


def classify_imaging_upload(
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> str:
    """Return ``dicom`` or ``nifti`` based on uploaded parts."""
    has_zip = file is not None and bool((file.filename or "").strip())
    if has_zip and (file.filename or "").lower().endswith(".zip"):
        return "dicom"
    if has_zip and _is_nifti_filename(file.filename or ""):
        return "nifti"

    parts = [f for f in (files or []) if f and (f.filename or "").strip()]
    if not has_zip and not parts:
        raise HTTPException(
            status_code=400,
            detail=(
                "No imaging data. Upload a DICOM ZIP / folder (.dcm) "
                "or a hippocampus MRI (.nii / .nii.gz)."
            ),
        )

    if has_zip and parts:
        raise HTTPException(
            status_code=400,
            detail="Provide either one archive/file in `file` or items in `files`, not both.",
        )

    if parts:
        if all(_is_dicom_filename(f.filename or "") for f in parts):
            return "dicom"
        if len(parts) == 1 and _is_nifti_filename(parts[0].filename or ""):
            return "nifti"

    if has_zip:
        name = (file.filename or "").lower()
        if _is_nifti_filename(name):
            return "nifti"
        raise HTTPException(
            status_code=400,
            detail="Field `file` must be a DICOM .zip or NIfTI (.nii / .nii.gz).",
        )

    raise HTTPException(
        status_code=400,
        detail="Unsupported upload. Use DICOM (.zip / .dcm) or NIfTI (.nii / .nii.gz).",
    )


async def materialize_dicom_upload_to_dir(
    temp_dir: Path,
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> None:
    """Write uploaded DICOM ZIP or slice files into ``temp_dir``."""
    temp_dir.mkdir(parents=True, exist_ok=True)
    zip_path = temp_dir.parent / f"{temp_dir.name}.zip"
    if file is not None:
        with zip_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        try:
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(temp_dir)
        except zipfile.BadZipFile as exc:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid ZIP archive.",
            ) from exc
        finally:
            try:
                zip_path.unlink(missing_ok=True)
            except OSError:
                pass
    else:
        assert files is not None
        for i, f in enumerate(files):
            raw = f.filename or ""
            leaf = Path(str(raw).replace("\\", "/")).name
            if not _is_dicom_filename(leaf):
                label = raw or f"file[{i}]"
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported type for {label!r}. Use .dcm or .dicom.",
                )
            dest_path = temp_dir / f"{i:04d}_{leaf}"
            with dest_path.open("wb") as out_f:
                shutil.copyfileobj(f.file, out_f)


def persist_dicom_series(src_dir: Path, dest_dir: Path) -> Path:
    """Copy extracted DICOM series to durable storage."""
    dest_dir.parent.mkdir(parents=True, exist_ok=True)
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    shutil.copytree(src_dir, dest_dir)
    return dest_dir
