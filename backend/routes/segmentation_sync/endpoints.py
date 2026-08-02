"""Slicer/bridge segmentation sync: revisions, masks, SSE."""

from __future__ import annotations

import json
from pathlib import Path
from time import perf_counter

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from auth import (
    TokenPayload,
    get_current_user,
    get_current_user_from_bearer_or_query,
    get_owned_study_or_404,
)
from models.db import get_session
from models.models import SegmentationResultORM
from schemas import (
    SegmentationRevisionCreate,
    SegmentationSyncStatus,
    SegmentationUpdateResponse,
)
from services.ai.inference import (
    compute_class_metrics,
    estimate_zonal_distribution,
    generate_mesh_exports,
)
from services.core.paths import STATIC_MESH_DIR, SYNC_STORAGE
from services.studies.analysis_state import MASK_STORAGE, _analysis_cache
from services.sync.events import study_event_hub
from services.sync.segmentation import append_revision, decode_mask, load_manifest

from .helpers import (
    as_revision_info,
    assert_mask_changed,
    load_study_volume_and_spacing,
    now_utc,
    parse_revision_geometry,
    validate_mask_shape_matches_volume,
    validate_revision_labels,
    validate_spacing_matches_volume,
)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def _refresh_analysis_cache(
    study_id: str,
    *,
    mask: np.ndarray,
    mesh_url: str,
    stl_url: str,
    class_metrics: dict,
    zonal: dict,
) -> None:
    _analysis_cache[study_id] = {
        "mask": mask,
        "mesh_url": mesh_url,
        "stl_url": stl_url,
        "volume_total_mm3": float(class_metrics["total_ild_volume_ml"] * 1000.0),
        "ild_fraction": float(class_metrics["ild_burden"]),
        "ild_burden": float(class_metrics["ild_burden"]),
        "zonal_distribution": zonal,
        "lung_volume_ml": class_metrics["lung_volume_ml"],
        "ggo_volume_ml": class_metrics["ggo_volume_ml"],
        "reticulation_volume_ml": class_metrics["reticulation_volume_ml"],
        "consolidation_volume_ml": class_metrics["consolidation_volume_ml"],
        "ggo_burden": class_metrics["ggo_burden"],
        "reticulation_burden": class_metrics["reticulation_burden"],
        "consolidation_burden": class_metrics["consolidation_burden"],
    }


def _update_segmentation_row(
    seg: SegmentationResultORM,
    *,
    class_metrics: dict,
    zonal: dict,
    mesh_url: str,
    stl_url: str,
    mask_disk_path: Path,
    mask: np.ndarray,
    revision_id: int,
    revision_note: str | None,
) -> None:
    seg.total_ild_volume_ml = class_metrics["total_ild_volume_ml"]
    seg.ild_fraction = class_metrics["ild_burden"]
    seg.lung_volume_ml = class_metrics["lung_volume_ml"]
    seg.ggo_volume_ml = class_metrics["ggo_volume_ml"]
    seg.reticulation_volume_ml = class_metrics["reticulation_volume_ml"]
    seg.consolidation_volume_ml = class_metrics["consolidation_volume_ml"]
    seg.ggo_burden = class_metrics["ggo_burden"]
    seg.reticulation_burden = class_metrics["reticulation_burden"]
    seg.consolidation_burden = class_metrics["consolidation_burden"]
    seg.zonal_distribution = zonal
    seg.mesh_url = mesh_url
    seg.stl_url = stl_url or ""
    seg.mask_path = str(mask_disk_path)
    seg.mask_shape = ",".join(str(v) for v in mask.shape)
    seg.mask_bytes = None
    meta: dict = {"segmentation_sync_revision_id": revision_id}
    if revision_note:
        meta["revision_note"] = revision_note
    if hasattr(seg, "description"):
        seg.description = json.dumps(meta) if meta else None


def _patch_manifest_mesh_urls(study_id: str, mesh_url: str, stl_url: str) -> None:
    manifest = load_manifest(SYNC_STORAGE, study_id)
    if not manifest.get("revisions"):
        return
    manifest["revisions"][-1]["mesh_url"] = mesh_url
    manifest["revisions"][-1]["stl_url"] = stl_url
    with (SYNC_STORAGE / study_id / "manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)


async def _publish_sync_events(
    study_id: str,
    *,
    revision_id: int,
    mesh_url: str,
    stl_url: str,
    class_metrics: dict,
    zonal: dict,
    started: float,
) -> None:
    event_base = {
        "study_id": study_id,
        "revision_id": revision_id,
        "mesh_url": mesh_url,
        "stl_url": stl_url,
        "metrics": class_metrics,
        "zonal_distribution": zonal,
        "ts": now_utc().isoformat(),
        "processing_ms": round((perf_counter() - started) * 1000.0, 2),
    }
    await study_event_hub.publish(study_id, {"event": "segmentation.updated", **event_base})
    await study_event_hub.publish(study_id, {"event": "mesh.updated", **event_base})
    await study_event_hub.publish(study_id, {"event": "metrics.updated", **event_base})


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/{study_id}/segmentation-sync/status",
    response_model=SegmentationSyncStatus,
    summary="Segmentation sync: latest revision",
    name="seg_sync_status",
)
async def get_segmentation_sync_status(
    study_id: str,
    current_user: TokenPayload = Depends(get_current_user_from_bearer_or_query),
) -> SegmentationSyncStatus:
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    manifest = load_manifest(SYNC_STORAGE, study_id)
    revisions = manifest.get("revisions", [])
    latest = as_revision_info(study_id, revisions[-1]) if revisions else None
    return SegmentationSyncStatus(
        study_id=study_id,
        current_revision_id=int(manifest.get("current_revision_id", 0)),
        latest=latest,
    )


@router.post(
    "/{study_id}/segmentation-revisions",
    response_model=SegmentationUpdateResponse,
    summary="Segmentation sync: push new mask revision",
    name="seg_sync_post_revision",
)
async def post_segmentation_revision(
    study_id: str,
    payload: SegmentationRevisionCreate,
    current_user: TokenPayload = Depends(get_current_user),
) -> SegmentationUpdateResponse:
    started = perf_counter()

    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    shape_zyx, spacing_zyx_mm, orientation = parse_revision_geometry(payload)
    study_vol = load_study_volume_and_spacing(study_id)
    validate_mask_shape_matches_volume(shape_zyx, study_vol.data)
    validate_spacing_matches_volume(spacing_zyx_mm, study_vol.spacing_zyx)
    labels = validate_revision_labels(payload.labels)

    try:
        mask = decode_mask(payload.mask_b64, shape_zyx)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    manifest = load_manifest(SYNC_STORAGE, study_id)
    assert_mask_changed(manifest, mask)

    revision = append_revision(
        SYNC_STORAGE,
        study_id,
        source=payload.source,
        revision_note=payload.revision_note,
        shape_zyx=shape_zyx,
        spacing_zyx_mm=spacing_zyx_mm,
        orientation=orientation,
        labels=labels,
        mask=mask,
    )

    MASK_STORAGE.mkdir(parents=True, exist_ok=True)
    mask_disk_path = MASK_STORAGE / f"{study_id}.npy"
    np.save(mask_disk_path, mask.astype("uint8"))

    class_metrics = compute_class_metrics(
        mask, study_vol.spacing_zyx, lung_mask=(mask > 0).astype(np.uint8)
    )
    zonal = estimate_zonal_distribution(mask)
    mesh_base = f"{study_id}_slicer_rev{revision.revision_id}"
    mesh_result = generate_mesh_exports(
        mask,
        STATIC_MESH_DIR,
        study_vol.spacing_zyx,
        volume=study_vol.data,
        output_basename=mesh_base,
    )
    mesh_url = mesh_result.glb_url
    stl_url = mesh_result.stl_url

    _refresh_analysis_cache(
        study_id,
        mask=mask,
        mesh_url=mesh_url,
        stl_url=stl_url,
        class_metrics=class_metrics,
        zonal=zonal,
    )

    with get_session() as session:
        study = get_owned_study_or_404(session, study_id, current_user)
        if study.segmentation:
            _update_segmentation_row(
                study.segmentation,
                class_metrics=class_metrics,
                zonal=zonal,
                mesh_url=mesh_url,
                stl_url=stl_url,
                mask_disk_path=mask_disk_path,
                mask=mask,
                revision_id=revision.revision_id,
                revision_note=payload.revision_note,
            )

    _patch_manifest_mesh_urls(study_id, mesh_url, stl_url)
    await _publish_sync_events(
        study_id,
        revision_id=revision.revision_id,
        mesh_url=mesh_url,
        stl_url=stl_url,
        class_metrics=class_metrics,
        zonal=zonal,
        started=started,
    )

    return SegmentationUpdateResponse(
        study_id=study_id,
        revision_id=revision.revision_id,
        accepted_at=now_utc(),
        mesh_url=mesh_url,
        stl_url=stl_url or None,
        metrics={k: float(v) for k, v in class_metrics.items()},
    )


@router.get(
    "/{study_id}/segmentation-revisions/{revision_id}/mask",
    summary="Download revision mask (raw bytes, X-Mask-Shape)",
    name="seg_sync_revision_mask",
)
async def get_segmentation_revision_mask(
    study_id: str,
    revision_id: int,
    current_user: TokenPayload = Depends(get_current_user_from_bearer_or_query),
):
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    manifest = load_manifest(SYNC_STORAGE, study_id)
    revisions = manifest.get("revisions", [])
    match = next(
        (r for r in revisions if int(r.get("revision_id", 0)) == int(revision_id)),
        None,
    )
    if not match:
        raise HTTPException(status_code=404, detail="Revision not found.")
    mask_path = Path(str(match.get("mask_path", "")))
    if not mask_path.exists():
        raise HTTPException(status_code=404, detail="Revision mask file missing.")
    arr = np.load(mask_path).astype(np.uint8)
    return StreamingResponse(
        iter([arr.tobytes()]),
        media_type="application/octet-stream",
        headers={"X-Mask-Shape": ",".join(str(int(v)) for v in arr.shape)},
    )


@router.get(
    "/{study_id}/events",
    summary="Server-Sent Events: segmentation + mesh + metrics for study",
    name="seg_sync_events_stream",
)
async def stream_study_events(
    study_id: str,
    current_user: TokenPayload = Depends(get_current_user_from_bearer_or_query),
):
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    async def _event_stream():
        status = await get_segmentation_sync_status(study_id, current_user)
        yield f"event: segmentation.status\ndata: {status.model_dump_json()}\n\n"
        async for event in study_event_hub.subscribe(study_id):
            yield f"event: {event.get('event', 'message')}\ndata: {json.dumps(event)}\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )