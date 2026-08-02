"""Pull study assets from GrayMatter API into a Slicer workspace."""
from __future__ import annotations

import json
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np

from common.api_client import ApiClient
from common.segmentation_sync import HIPPO_LABELS

__all__ = ["pull_study_workspace"]


def _parse_mask_shape_header(header: str | None) -> tuple[int, int, int]:
    if not header:
        raise ValueError("Mask shape header missing from GET /studies/{id}/mask")
    parts = [int(p.strip()) for p in header.split(",") if p.strip()]
    if len(parts) != 3:
        raise ValueError(f"Invalid X-Mask-Shape header: {header!r}")
    return (parts[0], parts[1], parts[2])


def _get_mask_with_shape(client: ApiClient, study_id: str) -> tuple[np.ndarray, tuple[int, int, int]]:
    data, headers = client.get_blob_with_headers(f"/studies/{study_id}/mask")
    shape_header = headers.get("X-Mask-Shape") or headers.get("x-mask-shape")
    shape = _parse_mask_shape_header(shape_header)
    arr = np.frombuffer(data, dtype=np.uint8).reshape(shape)
    return arr, shape


def pull_study_workspace(
    client: ApiClient,
    study_id: str,
    out_dir: Path,
) -> dict[str, Any]:
    """Download DICOM (if available), mask, geometry, and mesh URLs into ``out_dir``."""
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    dicom_dir = out_dir / "dicom"
    dicom_dir.mkdir(parents=True, exist_ok=True)

    geometry = client.get_json(f"/studies/{study_id}/dicom-shape")
    geometry_path = out_dir / "geometry.json"
    geometry_path.write_text(json.dumps(geometry, indent=2), encoding="utf-8")

    imaging_source = "unknown"
    dicom_zip_error: str | None = None
    nifti_path: Path | None = None
    nifti_note: str | None = None
    try:
        blob = client.get_blob(f"/studies/{study_id}/dicom-zip")
        with zipfile.ZipFile(BytesIO(blob)) as zf:
            zf.extractall(dicom_dir)
        if any(dicom_dir.rglob("*.dcm")) or any(dicom_dir.rglob("*.DCM")):
            imaging_source = "dicom"
        else:
            dicom_zip_error = "DICOM ZIP contained no .dcm files"
    except Exception as exc:  # noqa: BLE001
        dicom_zip_error = str(exc)

    if imaging_source != "dicom":
        try:
            nifti_blob, nifti_headers = client.get_blob_with_headers(f"/studies/{study_id}/nifti")
            disposition = nifti_headers.get("Content-Disposition") or nifti_headers.get("content-disposition") or ""
            filename = "volume.nii.gz"
            if "filename=" in disposition:
                filename = disposition.split("filename=", 1)[-1].strip().strip('"')
            nifti_path = out_dir / filename
            nifti_path.write_bytes(nifti_blob)
            imaging_source = "nifti"
        except Exception as nifti_exc:  # noqa: BLE001
            imaging_source = "unknown"
            if dicom_zip_error:
                nifti_note = f"DICOM unavailable ({dicom_zip_error}); NIfTI download failed: {nifti_exc}"
            else:
                nifti_note = f"NIfTI download failed: {nifti_exc}"

    mask, mask_shape = _get_mask_with_shape(client, study_id)
    mask_path = out_dir / "ai_mask.npy"
    np.save(mask_path, mask.astype(np.uint8))

    mesh_urls = client.get_json(f"/studies/{study_id}/mesh")
    mesh_path = out_dir / "mesh_urls.json"
    mesh_path.write_text(json.dumps(mesh_urls, indent=2), encoding="utf-8")

    manifest: dict[str, Any] = {
        "study_id": study_id,
        "api_base": client.api_base,
        "imaging_source": imaging_source,
        "dicom_dir": str(dicom_dir),
        "geometry_path": str(geometry_path),
        "geometry": geometry,
        "mask_path": str(mask_path),
        "mask_shape_zyx": list(mask_shape),
        "mesh_urls_path": str(mesh_path),
        "mesh_urls": mesh_urls,
        "labels": dict(HIPPO_LABELS),
        "orientation": "zyx",
        "spacing_zyx_mm": [
            float(geometry.get("spacing_z_mm", 1.0)),
            float(geometry.get("spacing_y_mm", 1.0)),
            float(geometry.get("spacing_x_mm", 1.0)),
        ],
        "shape_zyx": [
            int(geometry.get("depth", mask_shape[0])),
            int(geometry.get("height", mask_shape[1])),
            int(geometry.get("width", mask_shape[2])),
        ],
    }
    if nifti_path is not None:
        manifest["nifti_path"] = str(nifti_path)
    if dicom_zip_error:
        manifest["dicom_zip_note"] = dicom_zip_error
    if imaging_source == "unknown":
        manifest["nifti_note"] = nifti_note or "No DICOM or NIfTI available on server for this study."

    manifest_path = out_dir / "slicer_import_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    manifest["manifest_path"] = str(manifest_path)
    return manifest
