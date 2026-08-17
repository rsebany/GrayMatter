"""Slicer/bridge segmentation sync: revisions, masks, SSE."""

from __future__ import annotations

import copy
import hashlib
import json
import logging
from pathlib import Path
from time import perf_counter
from typing import Annotated

import numpy as np
from auth import (
    TokenPayload,
    get_current_user,
    get_current_user_from_bearer_or_query,
    get_owned_study_or_404,
    get_slicer_integration_user,
    has_permission,
)
from fastapi import APIRouter, Depends, HTTPException
from fastapi import Path as PathParam
from fastapi.responses import StreamingResponse
from models.db import get_session
from models.models import SegmentationResultORM
from schemas import (
    SegmentationRevisionCreate,
    SegmentationRevisionInfo,
    SegmentationRollbackCreate,
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
from services.sync.segmentation import (
    LABEL_CONTRACT,
    accept_revision,
    atomic_save_mask,
    begin_revision,
    decode_mask,
    fail_revision,
    get_revision,
    load_manifest,
    resolve_revision_mask_path,
    revision_lock,
)

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

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()
StudyId = Annotated[
    str,
    PathParam(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$",
    ),
]

_SEGMENTATION_STATE_FIELDS = (
    "total_ild_volume_ml",
    "ild_fraction",
    "lung_volume_ml",
    "ggo_volume_ml",
    "reticulation_volume_ml",
    "consolidation_volume_ml",
    "ggo_burden",
    "reticulation_burden",
    "consolidation_burden",
    "zonal_distribution",
    "mesh_url",
    "stl_url",
    "mask_path",
    "mask_shape",
    "mask_bytes",
    "description",
)


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


def _snapshot_segmentation_row(seg: SegmentationResultORM) -> dict[str, object]:
    return {
        field: copy.deepcopy(getattr(seg, field))
        for field in _SEGMENTATION_STATE_FIELDS
        if hasattr(seg, field)
    }


def _restore_segmentation_row(
    seg: SegmentationResultORM,
    snapshot: dict[str, object],
) -> None:
    for field, value in snapshot.items():
        setattr(seg, field, copy.deepcopy(value))


def _restore_active_mask(path: Path, previous_mask: np.ndarray | None) -> None:
    if previous_mask is None:
        path.unlink(missing_ok=True)
    else:
        atomic_save_mask(path, previous_mask)


def _restore_analysis_cache(
    study_id: str,
    *,
    existed: bool,
    snapshot: dict | None,
) -> None:
    if existed:
        _analysis_cache[study_id] = copy.deepcopy(snapshot)
    else:
        _analysis_cache.pop(study_id, None)


def _audit_workstation_id(value: str | None) -> str | None:
    """Keep a correlatable audit value without storing a workstation name."""
    if not value:
        return None
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _compensate_unaccepted_revision(
    study_id: str,
    *,
    current_user: TokenPayload,
    mask_disk_path: Path,
    previous_active_mask: np.ndarray | None,
    previous_segmentation_state: dict[str, object] | None,
    analysis_cache_existed: bool,
    previous_analysis_cache: dict | None,
) -> None:
    """Restore every active-state store after pre-acceptance failure."""
    errors: list[Exception] = []
    try:
        _restore_active_mask(mask_disk_path, previous_active_mask)
    except Exception as exc:  # noqa: BLE001 - compensation must attempt every store
        errors.append(exc)

    if previous_segmentation_state is not None:
        try:
            with get_session() as session:
                study = get_owned_study_or_404(session, study_id, current_user)
                if not study.segmentation:
                    raise RuntimeError("Segmentation row disappeared during compensation.")
                _restore_segmentation_row(
                    study.segmentation,
                    previous_segmentation_state,
                )
                session.flush()
        except Exception as exc:  # noqa: BLE001 - compensation must attempt every store
            errors.append(exc)

    try:
        _restore_analysis_cache(
            study_id,
            existed=analysis_cache_existed,
            snapshot=previous_analysis_cache,
        )
    except Exception as exc:  # noqa: BLE001 - compensation must attempt every store
        errors.append(exc)

    if errors:
        messages = "; ".join(f"{type(exc).__name__}: {exc}" for exc in errors)
        raise RuntimeError(f"Revision compensation failed: {messages}")


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


async def _process_revision(
    study_id: str,
    *,
    current_user: TokenPayload,
    mask: np.ndarray,
    study_volume,
    shape_zyx: tuple[int, int, int],
    spacing_zyx_mm: tuple[float, float, float],
    orientation: str,
    source: str,
    revision_note: str | None,
    module_name: str | None,
    module_version: str | None,
    workstation_id: str | None,
    rollback_of_revision_id: int | None = None,
) -> SegmentationUpdateResponse:
    started = perf_counter()
    revision = begin_revision(
        SYNC_STORAGE,
        study_id,
        source=source,
        revision_note=revision_note,
        shape_zyx=shape_zyx,
        spacing_zyx_mm=spacing_zyx_mm,
        orientation=orientation,
        labels=LABEL_CONTRACT,
        mask=mask,
        user_id=current_user.sub,
        module_name=module_name,
        module_version=module_version,
        workstation_id=workstation_id,
        rollback_of_revision_id=rollback_of_revision_id,
    )

    mask_disk_path = MASK_STORAGE / f"{study_id}.npy"
    previous_active_mask = (
        np.load(mask_disk_path, allow_pickle=False).astype(np.uint8)
        if mask_disk_path.exists()
        else None
    )
    previous_segmentation_state: dict[str, object] | None = None
    analysis_cache_existed = study_id in _analysis_cache
    previous_analysis_cache = (
        copy.deepcopy(_analysis_cache[study_id]) if analysis_cache_existed else None
    )
    durably_accepted = False
    try:
        class_metrics = compute_class_metrics(
            mask,
            study_volume.spacing_zyx,
            lung_mask=(mask > 0).astype(np.uint8),
        )
        zonal = estimate_zonal_distribution(mask)
        mesh_base = f"{study_id}_slicer_rev{revision.revision_id}"
        mesh_result = generate_mesh_exports(
            mask,
            STATIC_MESH_DIR,
            study_volume.spacing_zyx,
            volume=study_volume.data,
            output_basename=mesh_base,
        )
        mesh_url = mesh_result.glb_url
        stl_url = mesh_result.stl_url

        with get_session() as session:
            study = get_owned_study_or_404(session, study_id, current_user)
            atomic_save_mask(mask_disk_path, mask)
            if study.segmentation:
                previous_segmentation_state = _snapshot_segmentation_row(
                    study.segmentation
                )
                _update_segmentation_row(
                    study.segmentation,
                    class_metrics=class_metrics,
                    zonal=zonal,
                    mesh_url=mesh_url,
                    stl_url=stl_url,
                    mask_disk_path=mask_disk_path,
                    mask=mask,
                    revision_id=revision.revision_id,
                    revision_note=revision_note,
                )
                session.flush()

        accepted = accept_revision(
            SYNC_STORAGE,
            study_id,
            revision.revision_id,
            mesh_url=mesh_url,
            stl_url=stl_url,
        )
        durably_accepted = True
        _refresh_analysis_cache(
            study_id,
            mask=mask,
            mesh_url=mesh_url,
            stl_url=stl_url,
            class_metrics=class_metrics,
            zonal=zonal,
        )
    except Exception as exc:
        compensation_error: Exception | None = None
        if not durably_accepted:
            try:
                _compensate_unaccepted_revision(
                    study_id,
                    current_user=current_user,
                    mask_disk_path=mask_disk_path,
                    previous_active_mask=previous_active_mask,
                    previous_segmentation_state=previous_segmentation_state,
                    analysis_cache_existed=analysis_cache_existed,
                    previous_analysis_cache=previous_analysis_cache,
                )
            except Exception as compensation_exc:  # noqa: BLE001
                compensation_error = compensation_exc
        if compensation_error is not None:
            # Do not label a revision failed unless all active pointers were
            # first restored; this invariant prevents a failed revision from
            # remaining externally active.
            raise compensation_error from exc
        try:
            manifest = load_manifest(SYNC_STORAGE, study_id)
            item = get_revision(manifest, revision.revision_id)
            if item and item.get("status") == "pending":
                fail_revision(
                    SYNC_STORAGE,
                    study_id,
                    revision.revision_id,
                    "Revision processing failed.",
                )
        except Exception:
            logger.warning(
                "Could not mark failed segmentation revision %s for study %s.",
                revision.revision_id,
                study_id,
                exc_info=True,
            )
        raise

    # Events are deliberately emitted only after the accepted manifest is durable.
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
        accepted_at=accepted["accepted_at"],
        status="accepted",
        mesh_url=mesh_url,
        stl_url=stl_url or None,
        metrics={k: float(v) for k, v in class_metrics.items()},
    )


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
    study_id: StudyId,
    current_user: Annotated[TokenPayload, Depends(get_current_user_from_bearer_or_query)],
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


@router.get(
    "/{study_id}/segmentation-revisions",
    response_model=list[SegmentationRevisionInfo],
    summary="Segmentation sync: revision history",
    name="seg_sync_revision_history",
)
async def get_segmentation_revision_history(
    study_id: StudyId,
    current_user: Annotated[TokenPayload, Depends(get_current_user_from_bearer_or_query)],
) -> list[SegmentationRevisionInfo]:
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)
    revisions = load_manifest(SYNC_STORAGE, study_id).get("revisions", [])
    return [as_revision_info(study_id, item) for item in reversed(revisions)]


@router.post(
    "/{study_id}/segmentation-revisions",
    response_model=SegmentationUpdateResponse,
    summary="Segmentation sync: push new mask revision",
    name="seg_sync_post_revision",
)
async def post_segmentation_revision(
    study_id: StudyId,
    payload: SegmentationRevisionCreate,
    current_user: Annotated[TokenPayload, Depends(get_slicer_integration_user)],
) -> SegmentationUpdateResponse:
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    shape_zyx, spacing_zyx_mm, orientation = parse_revision_geometry(payload)
    study_vol = load_study_volume_and_spacing(study_id)
    validate_mask_shape_matches_volume(shape_zyx, study_vol.data)
    validate_spacing_matches_volume(spacing_zyx_mm, study_vol.spacing_zyx)
    validate_revision_labels(payload.labels)

    try:
        mask = decode_mask(payload.mask_b64, shape_zyx)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    manifest = load_manifest(SYNC_STORAGE, study_id)
    assert_mask_changed(manifest, mask)
    with revision_lock(study_id, SYNC_STORAGE):
        # Re-check after acquiring the per-study activation lock.
        assert_mask_changed(load_manifest(SYNC_STORAGE, study_id), mask)
        return await _process_revision(
            study_id,
            current_user=current_user,
            mask=mask,
            study_volume=study_vol,
            shape_zyx=shape_zyx,
            spacing_zyx_mm=spacing_zyx_mm,
            orientation=orientation,
            source=payload.source,
            revision_note=payload.revision_note,
            module_name=payload.module_name,
            module_version=payload.module_version,
            workstation_id=_audit_workstation_id(payload.workstation_id),
        )


@router.post(
    "/{study_id}/segmentation-revisions/{revision_id}/rollback",
    response_model=SegmentationUpdateResponse,
    summary="Segmentation sync: rollback as a new revision",
    name="seg_sync_rollback_revision",
)
async def rollback_segmentation_revision(
    study_id: StudyId,
    revision_id: int,
    payload: SegmentationRollbackCreate,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> SegmentationUpdateResponse:
    if not has_permission(current_user.role, "trigger_ai"):
        raise HTTPException(
            status_code=403,
            detail="Segmentation editing permission is required.",
        )
    with get_session() as session:
        get_owned_study_or_404(session, study_id, current_user)

    with revision_lock(study_id, SYNC_STORAGE):
        manifest = load_manifest(SYNC_STORAGE, study_id)
        target = get_revision(manifest, revision_id)
        if target is None:
            raise HTTPException(status_code=404, detail="Revision not found.")
        if target.get("status", "accepted") != "accepted":
            raise HTTPException(
                status_code=409,
                detail="Only accepted revisions can be rolled back.",
            )
        try:
            mask_path = resolve_revision_mask_path(
                SYNC_STORAGE, study_id, str(target.get("mask_path", ""))
            )
        except ValueError as exc:
            raise HTTPException(status_code=409, detail="Revision mask path is invalid.") from exc
        if not mask_path.is_file():
            raise HTTPException(status_code=404, detail="Revision mask file missing.")

        mask = np.load(mask_path, allow_pickle=False).astype(np.uint8)
        assert_mask_changed(manifest, mask)
        geometry = target["geometry"]
        shape_zyx = tuple(int(value) for value in geometry["shape_zyx"])
        spacing_zyx_mm = tuple(float(value) for value in geometry["spacing_zyx_mm"])
        orientation = str(geometry.get("orientation", "zyx"))
        study_vol = load_study_volume_and_spacing(study_id)
        validate_mask_shape_matches_volume(shape_zyx, study_vol.data)
        validate_spacing_matches_volume(spacing_zyx_mm, study_vol.spacing_zyx)
        validate_revision_labels(target.get("labels") or LABEL_CONTRACT)
        note = payload.revision_note or f"Rollback to revision {revision_id}"
        return await _process_revision(
            study_id,
            current_user=current_user,
            mask=mask,
            study_volume=study_vol,
            shape_zyx=shape_zyx,
            spacing_zyx_mm=spacing_zyx_mm,
            orientation=orientation,
            source="manual",
            revision_note=note,
            module_name=payload.module_name,
            module_version=payload.module_version,
            workstation_id=_audit_workstation_id(payload.workstation_id),
            rollback_of_revision_id=revision_id,
        )


@router.get(
    "/{study_id}/segmentation-revisions/{revision_id}/mask",
    summary="Download revision mask (raw bytes, X-Mask-Shape)",
    name="seg_sync_revision_mask",
)
async def get_segmentation_revision_mask(
    study_id: StudyId,
    revision_id: int,
    current_user: Annotated[TokenPayload, Depends(get_current_user_from_bearer_or_query)],
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
    if match.get("status", "accepted") != "accepted":
        raise HTTPException(status_code=409, detail="Revision mask is not available.")
    try:
        mask_path = resolve_revision_mask_path(
            SYNC_STORAGE, study_id, str(match.get("mask_path", ""))
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Revision mask file missing.") from exc
    if not mask_path.exists():
        raise HTTPException(status_code=404, detail="Revision mask file missing.")
    arr = np.load(mask_path, allow_pickle=False).astype(np.uint8)
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
    study_id: StudyId,
    current_user: Annotated[TokenPayload, Depends(get_current_user_from_bearer_or_query)],
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