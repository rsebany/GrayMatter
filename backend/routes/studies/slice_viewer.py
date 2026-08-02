"""2D slice PNGs: MRI windowing, hippocampus overlay, expert-compare dual panel."""

from __future__ import annotations

from io import BytesIO
from typing import Literal

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Response, status
from PIL import Image, ImageDraw
from scipy.ndimage import zoom

from auth import TokenPayload, get_current_user_from_bearer_or_query, get_owned_study_or_404
from models.db import get_session
from services.studies.analysis_state import MASK_STORAGE

from .common import (
    StudyVolume,
    _load_study_volume,
    _plane_to_display_rgb,
)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/studies", tags=["studies"])

Orientation = Literal["axial", "coronal", "sagittal"]

_OVERLAY_COLORS: dict[int, np.ndarray] = {
    1: np.array([16.0, 185.0, 129.0], dtype=np.float32),
    2: np.array([99.0, 102.0, 241.0], dtype=np.float32),
}


# ---------------------------------------------------------------------------
# Overlay & mask alignment
# ---------------------------------------------------------------------------


def _apply_hippocampus_overlay_to_rgb(
    rgb: np.ndarray,
    mask_slice: np.ndarray,
    overlay_opacity: float,
) -> None:
    if not np.any(mask_slice > 0):
        return
    alpha = float(min(1.0, max(0.0, overlay_opacity)))
    for class_id, color in _OVERLAY_COLORS.items():
        class_mask = mask_slice == class_id
        if not np.any(class_mask):
            continue
        rgb_masked = rgb[class_mask].astype(np.float32)
        rgb[class_mask] = np.clip(
            (1.0 - alpha) * rgb_masked + alpha * color,
            0,
            255,
        ).astype(np.uint8)


def _axial_mask_slice_resized_to_ct(
    mask: np.ndarray,
    z_index: int,
    d: int,
    h: int,
    w: int,
) -> np.ndarray:
    md, mh, mw = mask.shape
    mask_z = z_index if md == d else int(round((z_index / max(d - 1, 1)) * max(md - 1, 0)))
    mask_slice = mask[mask_z, :, :].astype(np.float32, copy=False)
    if (mh, mw) != (h, w):
        mask_slice = zoom(mask_slice, (h / mh, w / mw), order=0)
    return np.rint(mask_slice).astype(np.uint8, copy=False)


def _png_response(rgb: np.ndarray) -> Response:
    buf = BytesIO()
    Image.fromarray(rgb, mode="RGB").save(buf, format="PNG")
    buf.seek(0)
    return Response(content=buf.read(), media_type="image/png")


# ---------------------------------------------------------------------------
# Volume load
# ---------------------------------------------------------------------------


def _volume_dims(study_vol: StudyVolume) -> tuple[int, int, int]:
    d, h, w = study_vol.data.shape
    return d, h, w


def _validate_slice_index(
    orientation: Orientation,
    z_index: int,
    d: int,
    h: int,
    w: int,
) -> int:
    if orientation == "axial":
        max_idx = d - 1
    elif orientation == "coronal":
        max_idx = h - 1
    else:
        max_idx = w - 1
    if z_index < 0 or z_index >= (max_idx + 1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"z_index must be in [0, {max_idx}] for {orientation}",
        )
    return max_idx


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/{study_id}/slices/{z_index}",
    summary="2D slice PNG (axial / coronal / sagittal, optional ILD overlay)",
    name="studies_slice_png",
)
async def get_study_slice_overlay(
    study_id: str,
    z_index: int,
    window_center: int = -600,
    window_width: int = 1500,
    orientation: str = "axial",
    include_overlay: bool = True,
    denoise: bool = False,
    overlay_opacity: float = 0.6,
    current_user: TokenPayload = Depends(get_current_user_from_bearer_or_query),
):
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    study_vol = _load_study_volume(study_id)
    vol = study_vol.data
    d, h, w = _volume_dims(study_vol)
    logp = f"[SliceOverlay {study_id} {orientation} z={z_index}]"

    orientation_norm = orientation.lower()
    if orientation_norm not in ("axial", "coronal", "sagittal"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid orientation: {orientation}. Must be axial, coronal, or sagittal",
        )
    orient: Orientation = orientation_norm  # type: ignore[assignment]
    max_idx = _validate_slice_index(orient, z_index, d, h, w)

    if not include_overlay:
        if orient == "axial":
            ct_slice_3d = vol[z_index, :, :]
        elif orient == "coronal":
            ct_slice_3d = vol[:, z_index, :]
        else:
            ct_slice_3d = vol[:, :, z_index]
        rgb = _plane_to_display_rgb(
            ct_slice_3d,
            window_center=window_center,
            window_width=window_width,
            denoise=denoise,
            is_hu=study_vol.is_hu,
        )
        print(
            f"{logp} original vol={vol.shape} slab={ct_slice_3d.shape} "
            f"z={z_index}/{max_idx} denoise={denoise} source={study_vol.source}"
        )
        return _png_response(rgb)

    mask_path = MASK_STORAGE / f"{study_id}.npy"
    if not mask_path.exists():
        if orient == "axial":
            ct_slice_3d = vol[z_index, :, :]
        elif orient == "coronal":
            ct_slice_3d = vol[:, z_index, :]
        else:
            ct_slice_3d = vol[:, :, z_index]
        rgb = _plane_to_display_rgb(
            ct_slice_3d,
            window_center=window_center,
            window_width=window_width,
            denoise=denoise,
            is_hu=study_vol.is_hu,
        )
        print(
            f"{logp} original vol={vol.shape} slab={ct_slice_3d.shape} "
            f"z={z_index}/{max_idx} denoise={denoise} source={study_vol.source} "
            f"(overlay requested but mask missing)"
        )
        return _png_response(rgb)
    mask = np.load(mask_path).astype(np.uint8)
    if mask.ndim != 3:
        raise HTTPException(status_code=500, detail="Stored mask has invalid shape")

    md, mh, mw = mask.shape

    if orient == "axial":
        ct_slice_3d = vol[z_index, :, :]
        mask_z = z_index if md == d else int(round((z_index / max(d - 1, 1)) * max(md - 1, 0)))
        mask_slice = mask[mask_z, :, :]
        slice_h, slice_w = h, w
        mask_slice_h, mask_slice_w = mh, mw
    elif orient == "coronal":
        ct_slice_3d = vol[:, z_index, :]
        mask_y = z_index if mh == h else int(round((z_index / max(h - 1, 1)) * max(mh - 1, 0)))
        mask_slice = mask[:, mask_y, :]
        slice_h, slice_w = d, w
        mask_slice_h, mask_slice_w = md, mw
    else:
        ct_slice_3d = vol[:, :, z_index]
        mask_x = z_index if mw == w else int(round((z_index / max(w - 1, 1)) * max(mw - 1, 0)))
        mask_slice = mask[:, :, mask_x]
        slice_h, slice_w = d, h
        mask_slice_h, mask_slice_w = md, mh

    resize_note = "ok"
    if (mask_slice_h, mask_slice_w) != (slice_h, slice_w):
        zoom_h = slice_h / mask_slice_h
        zoom_w = slice_w / mask_slice_w
        mask_slice = zoom(mask_slice, (zoom_h, zoom_w), order=0)
        resize_note = f"resized {mask_slice_h}x{mask_slice_w}->{mask_slice.shape[0]}x{mask_slice.shape[1]}"
    mask_slice = np.rint(mask_slice).astype(np.uint8, copy=False)

    n_pos = int(np.sum(mask_slice > 0))
    frac = n_pos / float(mask_slice.size) if mask_slice.size else 0.0
    print(
        f"{logp} vol={vol.shape} mask3d={mask.shape} "
        f"slab={ct_slice_3d.shape} z_idx={z_index}/{max_idx} "
        f"mask_fg={n_pos} ({frac * 100:.4f}%) {resize_note} source={study_vol.source}"
    )

    if mask_slice.shape != (slice_h, slice_w):
        raise HTTPException(status_code=500, detail="Mask/volume size mismatch after alignment")

    rgb = _plane_to_display_rgb(
        ct_slice_3d,
        window_center=window_center,
        window_width=window_width,
        denoise=denoise,
        is_hu=study_vol.is_hu,
    )
    _apply_hippocampus_overlay_to_rgb(rgb, mask_slice, overlay_opacity)
    return _png_response(rgb)


@router.get(
    "/{study_id}/expert-compare/slices/{z_index}",
    summary="Axial dual-panel PNG: CT+AI mask | CT+expert mask",
    name="studies_expert_compare_slice_png",
)
async def get_study_expert_compare_slice_dual(
    study_id: str,
    z_index: int,
    window_center: int = -600,
    window_width: int = 1500,
    denoise: bool = False,
    overlay_opacity: float = 0.6,
    current_user: TokenPayload = Depends(get_current_user_from_bearer_or_query),
):
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    study_vol = _load_study_volume(study_id)
    vol = study_vol.data
    d, h, w = _volume_dims(study_vol)
    max_idx = d - 1
    if z_index < 0 or z_index >= d:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"z_index must be in [0, {max_idx}] for expert-compare (axial)",
        )

    # Compare caches written by expert_mask_compare; fall back to live AI mask only.
    pred_path = MASK_STORAGE / f"{study_id}.prediction_compare.npy"
    expert_path = MASK_STORAGE / f"{study_id}.expert_compare.npy"
    if not pred_path.exists():
        pred_path = MASK_STORAGE / f"{study_id}.npy"
    if not pred_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI mask not available on disk")
    if not expert_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No expert comparison volume. Run Expert mask vs AI compare on Upload DICOM "
                "for this study first."
            ),
        )

    pred = np.load(pred_path).astype(np.uint8)
    expert = np.load(expert_path).astype(np.uint8)
    if pred.shape != expert.shape:
        raise HTTPException(
            status_code=500,
            detail=f"AI mask shape {pred.shape} != expert compare shape {expert.shape}",
        )

    ct_slice_3d = vol[z_index, :, :]
    rgb_base = _plane_to_display_rgb(
        ct_slice_3d,
        window_center=window_center,
        window_width=window_width,
        denoise=denoise,
        is_hu=study_vol.is_hu,
    )

    pred_slice = _axial_mask_slice_resized_to_ct(pred, z_index, d, h, w)
    expert_slice = _axial_mask_slice_resized_to_ct(expert, z_index, d, h, w)
    if pred_slice.shape != (h, w) or expert_slice.shape != (h, w):
        raise HTTPException(status_code=500, detail="Mask slice shape mismatch after resize")

    rgb_ai = rgb_base.copy()
    rgb_ex = rgb_base.copy()
    _apply_hippocampus_overlay_to_rgb(rgb_ai, pred_slice, overlay_opacity)
    _apply_hippocampus_overlay_to_rgb(rgb_ex, expert_slice, overlay_opacity)

    dual = np.concatenate([rgb_ai, rgb_ex], axis=1)
    pil = Image.fromarray(dual, mode="RGB")
    draw = ImageDraw.Draw(pil)
    label_h = 22
    draw.rectangle([0, 0, dual.shape[1] - 1, label_h], fill=(12, 12, 18))
    draw.text((8, 4), "AI prediction", fill=(230, 230, 240))
    draw.text((w + 8, 4), "Expert DICOM", fill=(230, 230, 240))
    draw.text((8, label_h + 4), "Class IDs: 1=Left hippocampus, 2=Right hippocampus", fill=(220, 220, 230))

    buf = BytesIO()
    pil.save(buf, format="PNG")
    buf.seek(0)
    return Response(content=buf.read(), media_type="image/png")
