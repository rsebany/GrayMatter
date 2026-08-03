"""Study outputs: mesh URL, mask bytes, DICOM shape, expert-compare mesh."""

from __future__ import annotations

import re
from io import BytesIO
from typing import Annotated

import numpy as np
from auth import TokenPayload, get_current_user, get_owned_study_or_404
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from models.db import get_session
from schemas import DicomVolumeShape
from services.ai.inference import generate_mesh_glb
from services.core.paths import STATIC_MESH_DIR
from services.studies.analysis_state import MASK_STORAGE, _analysis_cache

from .common import (
    _dicom_series_spacing_mm,
    _ensure_study_dicom_dir,
    _load_dicom_volume_and_slices,
    _load_study_volume,
)

# ---------------------------------------------------------------------------
# Router & constants
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/studies", tags=["studies"])

_MASK_LABEL_SEMANTICS = "0=background,1=ggo,2=reticulation,3=consolidation"


# ---------------------------------------------------------------------------
# Mask normalization
# ---------------------------------------------------------------------------


def _normalize_volume_to_classes_123(raw_volume: np.ndarray) -> tuple[np.ndarray, bool]:
    """Map arbitrary integer labels to model classes {0,1,2,3}."""
    v = np.ascontiguousarray(raw_volume, dtype=np.uint8)
    if v.ndim != 3:
        raise ValueError(f"Expected 3D mask volume, got shape={v.shape}")

    uniq = np.unique(v)
    positives = sorted(int(x) for x in uniq if x > 0)

    if not positives:
        return np.zeros_like(v, dtype=np.uint8), bool(np.any(v))

    if bool(np.all(v <= 3)):
        out = np.clip(v, 0, 3).astype(np.uint8, copy=False)
        return out, not np.array_equal(out, v)

    if len(positives) == 1:
        pv = positives[0]
        out = np.where(v == pv, 1, 0).astype(np.uint8, copy=False)
        return out, True

    if len(positives) <= 3:
        out = np.zeros_like(v, dtype=np.uint8)
        for new_lab, old_lab in enumerate(positives, start=1):
            out[v == old_lab] = new_lab
        return out, True

    fg = v > 0
    vals = v[fg].astype(np.float64)
    lo, hi = float(vals.min()), float(vals.max())
    if lo >= hi:
        out = np.zeros_like(v, dtype=np.uint8)
        out[fg] = 1
        return out, True

    t1 = float(np.percentile(vals, 100.0 / 3.0))
    t2 = float(np.percentile(vals, 200.0 / 3.0))
    vf = v.astype(np.float64)
    out = np.zeros_like(v, dtype=np.uint8)
    out[fg & (vf <= t1)] = 1
    out[fg & (vf > t1) & (vf <= t2)] = 2
    out[fg & (vf > t2)] = 3
    return out, True


def _mask_streaming_response(arr: np.ndarray) -> StreamingResponse:
    shape = arr.shape
    return StreamingResponse(
        BytesIO(arr.tobytes()),
        media_type="application/octet-stream",
        headers={
            "X-Mask-Shape": ",".join(str(int(x)) for x in shape),
            "X-Mask-Label-Semantics": _MASK_LABEL_SEMANTICS,
        },
    )


def _safe_study_file_token(study_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", study_id).strip("_") or "study"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/{study_id}/mesh",
    summary="3D mesh URLs (GLB + STL) for XR / viewer",
    name="studies_mesh_url",
)
async def get_study_mesh(
    study_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    if study_id in _analysis_cache and "mesh_url" in _analysis_cache[study_id]:
        mesh_url = _analysis_cache[study_id]["mesh_url"]
        stl_url = _analysis_cache[study_id].get("stl_url", "")
        if not isinstance(mesh_url, str) or not mesh_url.strip():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesh not found for this study")
        return {"mesh_url": mesh_url, "stl_url": stl_url or ""}

    with get_session() as session:
        study = get_owned_study_or_404(session, study_id, current_user)
        if not (study.segmentation and study.segmentation.mesh_url):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesh not found for this study")
        seg = study.segmentation
        return {
            "mesh_url": seg.mesh_url,
            "stl_url": getattr(seg, "stl_url", "") or "",
        }


@router.get(
    "/{study_id}/mesh/stl",
    summary="Download STL mesh for external 3D tools",
    name="studies_mesh_stl",
)
async def get_study_mesh_stl(
    study_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    payload = await get_study_mesh(study_id, current_user)
    stl_url = payload.get("stl_url", "")
    if not stl_url or not str(stl_url).strip():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="STL mesh not found for this study")
    return {"stl_url": stl_url}


# ---------------------------------------------------------------------------
# Expert-compare artifacts (after POST …/expert-mask-compare)
# ---------------------------------------------------------------------------


@router.get(
    "/{study_id}/expert-compare/expert-mesh",
    summary="GLB mesh from last expert DICOM compare",
    name="studies_expert_compare_expert_mesh",
)
async def get_expert_compare_expert_mesh(
    study_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Build or return cached GLB from ``{study_id}.expert_compare.npy`` (remapped expert labels)."""
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    npy_path = MASK_STORAGE / f"{study_id}.expert_compare.npy"
    if not npy_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No expert compare volume. Run expert mask compare on Upload DICOM first.",
        )

    token = _safe_study_file_token(study_id)
    glb_path = STATIC_MESH_DIR / f"expert_compare_{token}.glb"
    try:
        npy_mtime = npy_path.stat().st_mtime
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot read expert mask file: {exc}") from exc

    if glb_path.is_file():
        try:
            if glb_path.stat().st_mtime >= npy_mtime:
                return {"mesh_url": f"/static/meshes/{glb_path.name}"}
        except OSError:
            pass

    study_dicom_dir = _ensure_study_dicom_dir(study_id)
    if not study_dicom_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DICOM data not found on disk")

    try:
        volume, slices = _load_dicom_volume_and_slices(study_dicom_dir)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    slope = float(getattr(slices[0], "RescaleSlope", 1.0))
    intercept = float(getattr(slices[0], "RescaleIntercept", 0.0))
    vol_hu = volume * slope + intercept
    spacing = _dicom_series_spacing_mm(slices)

    expert = np.load(npy_path).astype(np.uint8)
    if expert.shape != vol_hu.shape:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Expert compare shape {tuple(expert.shape)} does not match CT "
                f"{tuple(vol_hu.shape)}; cannot build mesh."
            ),
        )

    mesh_url = generate_mesh_glb(
        expert,
        STATIC_MESH_DIR,
        spacing,
        volume_hu=vol_hu.astype(np.float32, copy=False),
        lung_mask=None,
        output_filename=f"expert_compare_{token}.glb",
    )
    if not mesh_url or not str(mesh_url).strip():
        raise HTTPException(
            status_code=422,
            detail="Expert mask produced an empty mesh (no foreground voxels to surface).",
        )
    return {"mesh_url": mesh_url}


@router.get(
    "/{study_id}/mask",
    summary="Raw segmentation mask bytes (X-Mask-Shape header)",
    name="studies_mask_bytes",
)
async def get_study_mask(
    study_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
):
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    mask_path = MASK_STORAGE / f"{study_id}.npy"
    if mask_path.exists():
        arr = np.load(mask_path).astype("uint8")
        if arr.ndim != 3:
            raise HTTPException(status_code=500, detail="Stored mask on disk has invalid shape; expected 3D volume.")
        arr, changed = _normalize_volume_to_classes_123(arr)
        if changed:
            np.save(mask_path, arr)
        return _mask_streaming_response(arr)

    with get_session() as session:
        study = get_owned_study_or_404(session, study_id, current_user)
        if study.segmentation and study.segmentation.mask_bytes:
            seg = study.segmentation
            if not seg.mask_shape:
                raise HTTPException(status_code=422, detail="Mask shape metadata missing for this study.")

            parts = [p.strip() for p in seg.mask_shape.split(",") if p.strip()]
            if len(parts) != 3:
                raise HTTPException(status_code=422, detail="Mask shape metadata invalid for this study.")

            try:
                d, h, w = (int(p) for p in parts)
            except ValueError:
                raise HTTPException(status_code=422, detail="Mask shape metadata contains non-integer values.")

            if d <= 0 or h <= 0 or w <= 0:
                raise HTTPException(status_code=422, detail="Mask shape metadata must be positive.")

            raw = bytes(seg.mask_bytes)
            expected_len = d * h * w
            if len(raw) != expected_len:
                raise HTTPException(status_code=422, detail="Mask bytes length does not match reported shape.")

            arr = np.frombuffer(raw, dtype=np.uint8).reshape(d, h, w)
            arr, _changed = _normalize_volume_to_classes_123(arr)
            disk_path = MASK_STORAGE / f"{study_id}.npy"
            np.save(disk_path, arr)
            seg.mask_path = str(disk_path)
            seg.mask_bytes = None
            seg.mask_shape = None
            return _mask_streaming_response(arr)

    if study_id in _analysis_cache and "mask" in _analysis_cache[study_id]:
        arr = _analysis_cache[study_id]["mask"].astype("uint8")
        if not isinstance(arr, np.ndarray) or arr.ndim != 3:
            raise HTTPException(status_code=500, detail="Cached mask has invalid shape; expected 3D volume.")
        arr, changed = _normalize_volume_to_classes_123(arr)
        if changed:
            _analysis_cache[study_id]["mask"] = arr
        return _mask_streaming_response(arr)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mask not available")


@router.get(
    "/{study_id}/dicom-shape",
    response_model=DicomVolumeShape,
    summary="Native DICOM volume shape + spacing (not mask grid)",
    name="studies_dicom_shape",
)
async def get_study_dicom_shape(
    study_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> DicomVolumeShape:
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    study_vol = _load_study_volume(study_id)
    d, h, w = study_vol.data.shape
    sz, sy, sx = study_vol.spacing_zyx
    return DicomVolumeShape(
        depth=int(d),
        height=int(h),
        width=int(w),
        spacing_z_mm=float(sz),
        spacing_y_mm=float(sy),
        spacing_x_mm=float(sx),
    )
