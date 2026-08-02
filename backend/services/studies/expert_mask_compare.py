"""Expert/reference DICOM mask vs stored AI prediction: align, remap, Dice."""
from __future__ import annotations

import logging
import shutil
import uuid
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import HTTPException, UploadFile

from services.ai.metrics import (
    compute_expert_vs_prediction_dice,
    expert_prediction_compare_diagnostics,
)
from services.core.paths import DICOM_STORAGE
from services.dicom.expert_volume_align import (
    auto_correct_inplane_flip,
    label_pixels_uint8_from_slice,
    stack_expert_volume_on_ct_grid,
)
from services.dicom.series_read import read_sorted_dicom_slices
from services.studies.upload import _normalize_dicom_upload

logger = logging.getLogger(__name__)

_COMPARE_SCOPE = "classes_1_2_3_only"
_MAPPING_CONFIDENCE = "strict_verified"

_GGO_TOKENS = {
    "ggo",
    "ground glass",
    "ground-glass",
    "groundglass",
    "glass opacity",
}
_RETIC_TOKENS = {
    "retic",
    "reticular",
    "reticulation",
    "fibrosis",
    "honeycomb",
}
_CONSOL_TOKENS = {
    "consolidation",
    "consolidative",
    "alveolar",
    "organizing pneumonia",
}

__all__ = [
    "compare_expert_dicom_to_prediction_volume",
    "run_expert_mask_compare_from_upload",
]

# ---------------------------------------------------------------------------
# Label text → class id (SEG / loose naming)
# ---------------------------------------------------------------------------


def _normalize_text(value: str) -> str:
    return " ".join((value or "").strip().lower().replace("_", " ").replace("-", " ").split())


def _label_to_class_id(label_text: str) -> int | None:
    txt = _normalize_text(label_text)
    if not txt:
        return None
    if any(tok in txt for tok in _GGO_TOKENS):
        return 1
    if any(tok in txt for tok in _RETIC_TOKENS):
        return 2
    if any(tok in txt for tok in _CONSOL_TOKENS):
        return 3
    return None


def _candidate_segment_texts(item: Any) -> list[str]:
    out: list[str] = []
    seg_label = getattr(item, "SegmentLabel", None)
    if seg_label:
        out.append(str(seg_label))

    seg_desc = getattr(item, "SegmentDescription", None)
    if seg_desc:
        out.append(str(seg_desc))

    for seq_name in ("SegmentedPropertyTypeCodeSequence", "AnatomicRegionSequence"):
        seq = getattr(item, seq_name, None)
        if not seq:
            continue
        for code_item in seq:
            cm = getattr(code_item, "CodeMeaning", None)
            if cm:
                out.append(str(cm))
    return out


def _extract_segment_class_map(expert_slices: list[Any]) -> dict[int, int]:
    """Extract SegmentNumber -> class_id mapping from DICOM SEG metadata."""
    for ds in expert_slices:
        seq = getattr(ds, "SegmentSequence", None)
        if not seq:
            continue

        mapping: dict[int, int] = {}
        for item in seq:
            try:
                seg_num = int(getattr(item, "SegmentNumber"))
            except Exception:
                continue

            class_id: int | None = None
            for text in _candidate_segment_texts(item):
                class_id = _label_to_class_id(text)
                if class_id is not None:
                    break

            if class_id is not None:
                mapping[seg_num] = class_id

        if mapping:
            return mapping

    return {}


# ---------------------------------------------------------------------------
# Volume normalization (strict expert, heuristic prediction)
# ---------------------------------------------------------------------------


def _normalize_prediction_volume_to_classes_123(
    raw_volume: np.ndarray,
) -> tuple[np.ndarray, dict[str, Any]]:
    """Normalize prediction labels to {0,1,2,3} deterministically."""
    v = np.ascontiguousarray(raw_volume, dtype=np.uint8)
    uniq = np.unique(v)
    raw_max = int(uniq.max()) if uniq.size else 0
    positives = sorted(int(x) for x in uniq if x > 0)

    meta: dict[str, Any] = {
        "prediction_label_max_raw": raw_max,
        "prediction_remap_mode": "empty",
        "prediction_remap_note": None,
    }

    if raw_max == 0:
        return np.zeros_like(v, dtype=np.uint8), meta

    if bool(np.all(v <= 3)):
        out = np.clip(v, 0, 3).astype(np.uint8, copy=False)
        meta["prediction_remap_mode"] = "native_0_to_3"
        meta["prediction_remap_note"] = "Prediction labels were already in 0-3."
        return out, meta

    if len(positives) == 1:
        pv = positives[0]
        out = np.where(v == pv, 1, 0).astype(np.uint8, copy=False)
        meta["prediction_remap_mode"] = "binary_to_class1"
        meta["prediction_remap_note"] = (
            f"Single non-zero prediction label {pv} was mapped to class 1 for comparison."
        )
        return out, meta

    if len(positives) <= 3:
        out = np.zeros_like(v, dtype=np.uint8)
        for new_lab, old_lab in enumerate(positives, start=1):
            out[v == old_lab] = new_lab
        meta["prediction_remap_mode"] = f"distinct_{len(positives)}_to_123"
        meta["prediction_remap_note"] = (
            "Prediction labels "
            + ", ".join(str(p) for p in positives)
            + " were mapped to classes 1.. in ascending order."
        )
        return out, meta

    fg = v > 0
    vals = v[fg].astype(np.float64)
    lo, hi = float(vals.min()), float(vals.max())
    if lo >= hi:
        out = np.zeros_like(v, dtype=np.uint8)
        out[fg] = 1
        meta["prediction_remap_mode"] = "many_flat_to_1"
        meta["prediction_remap_note"] = "Prediction had flat foreground intensity; mapped to class 1."
        return out, meta

    t1 = float(np.percentile(vals, 100.0 / 3.0))
    t2 = float(np.percentile(vals, 200.0 / 3.0))
    vf = v.astype(np.float64)
    out = np.zeros_like(v, dtype=np.uint8)
    out[fg & (vf <= t1)] = 1
    out[fg & (vf > t1) & (vf <= t2)] = 2
    out[fg & (vf > t2)] = 3
    meta["prediction_remap_mode"] = "many_values_percentile_123"
    meta["prediction_remap_note"] = "Prediction values were split by tertiles into classes 1-3."
    return out, meta


def _normalize_expert_volume_strict(
    raw_expert: np.ndarray,
    *,
    expert_slices: list[Any] | None,
) -> tuple[np.ndarray, dict[str, Any]]:
    """Strict expert semantic mapping: accept only explicit trustworthy mappings."""
    v = np.ascontiguousarray(raw_expert, dtype=np.uint8)
    uniq = np.unique(v)
    raw_max = int(uniq.max()) if uniq.size else 0
    positives = sorted(int(x) for x in uniq if x > 0)

    meta: dict[str, Any] = {
        "expert_label_max_raw": raw_max,
        "expert_remap_mode": "empty",
        "expert_remap_note": None,
        "mapping_source": "native_labels",
        "mapping_confidence": _MAPPING_CONFIDENCE,
        "comparison_scope": _COMPARE_SCOPE,
    }

    if raw_max == 0:
        return np.zeros_like(v, dtype=np.uint8), meta

    if bool(np.all(v <= 3)):
        out = np.clip(v, 0, 3).astype(np.uint8, copy=False)
        meta["expert_remap_mode"] = "native_0_to_3"
        meta["expert_remap_note"] = "Expert labels were already in 0-3."
        return out, meta

    segment_map = _extract_segment_class_map(expert_slices or [])
    if segment_map and positives and all(val in segment_map for val in positives):
        out = np.zeros_like(v, dtype=np.uint8)
        for old_value, class_id in segment_map.items():
            out[v == old_value] = class_id
        meta["expert_remap_mode"] = "dicom_seg_metadata"
        meta["expert_remap_note"] = (
            "Expert labels were mapped using DICOM SEG segment metadata. "
            f"Detected mapping: {segment_map}"
        )
        meta["mapping_source"] = "dicom_seg_metadata"
        return out, meta

    detected = sorted(int(x) for x in uniq)
    raise HTTPException(
        status_code=400,
        detail={
            "code": "EXPERT_MASK_LABEL_MAPPING_REQUIRED",
            "message": (
                "Expert mask labels are ambiguous for strict comparison. "
                "Provide native 0-3 labels (0=background,1=ggo,2=reticulation,3=consolidation) "
                "or upload DICOM SEG with segment names/codes that map to these classes."
            ),
            "detected_labels": detected,
            "mapping_required": {
                "1": "ggo",
                "2": "reticulation",
                "3": "consolidation",
            },
        },
    )


def _stack_label_volume_from_sorted_slices(slices: list[Any]) -> np.ndarray:
    """Fallback: stack mask DICOMs by Z sort only (no CT grid alignment)."""
    volume_slices = [label_pixels_uint8_from_slice(s) for s in slices]
    return np.stack(volume_slices, axis=0)


# ---------------------------------------------------------------------------
# Compare pipeline (sync core + async upload entry)
# ---------------------------------------------------------------------------


async def _materialize_dicom_upload_to_dir(
    temp_dir: Path,
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> None:
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
                logger.debug("expert-mask temp zip unlink failed", exc_info=True)
    else:
        assert files is not None
        for i, f in enumerate(files):
            raw = f.filename or ""
            leaf = Path(str(raw).replace("\\", "/")).name
            if not leaf.lower().endswith((".dcm", ".dicom")):
                label = raw or f"file[{i}]"
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported type for {label!r}. Use .dcm or .dicom.",
                )
            dest_path = temp_dir / f"{i:04d}_{leaf}"
            with dest_path.open("wb") as out_f:
                shutil.copyfileobj(f.file, out_f)


def compare_expert_dicom_to_prediction_volume(
    *,
    study_id: str,
    prediction: np.ndarray,
    expert_volume: np.ndarray,
    expert_slices: list[Any] | None = None,
    mask_storage: Path | None = None,
    alignment_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if prediction.ndim != 3 or expert_volume.ndim != 3:
        raise HTTPException(
            status_code=400,
            detail="Expert mask and prediction must be 3D volumes.",
        )

    pred_raw = prediction.astype(np.uint8, copy=False)
    expert_raw = expert_volume.astype(np.uint8, copy=False)

    expert, expert_meta = _normalize_expert_volume_strict(
        expert_raw,
        expert_slices=expert_slices,
    )
    pred, pred_meta = _normalize_prediction_volume_to_classes_123(pred_raw)

    remap_mode = str(expert_meta.get("expert_remap_mode", "unknown"))
    remap_note = expert_meta.get("expert_remap_note")
    pred_remap_mode = str(pred_meta.get("prediction_remap_mode", "unknown"))
    pred_remap_note = pred_meta.get("prediction_remap_note")
    max_seen_raw = int(expert_meta.get("expert_label_max_raw", 0))

    flip_mode = "none"
    flip_gain = 0
    if alignment_meta is None:
        alignment_meta = {}
    if expert.shape == pred.shape and np.any(expert > 0) and np.any(pred > 0):
        expert, flip_mode, flip_gain = auto_correct_inplane_flip(expert, pred)
        if flip_mode != "none":
            alignment_meta = {
                **alignment_meta,
                "expert_inplane_correction": flip_mode,
                "expert_inplane_overlap_gain": flip_gain,
            }

    expert_labels_were_clipped = False
    expert_labels_were_remapped = remap_mode not in ("native_0_to_3", "empty")
    prediction_labels_were_remapped = pred_remap_mode not in ("native_0_to_3", "empty")

    if expert.shape != pred.shape:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Shape mismatch: expert DICOM stack {tuple(expert.shape)} vs "
                f"stored prediction mask {tuple(pred.shape)}. "
                "Sort and resample the expert series to the same grid as the study CT."
            ),
        )

    dice = compute_expert_vs_prediction_dice(expert, pred)
    diagnostics = expert_prediction_compare_diagnostics(expert, pred)

    hint_extra_parts: list[str] = []
    if isinstance(remap_note, str) and remap_note.strip():
        hint_extra_parts.append(remap_note.strip())
    if isinstance(pred_remap_note, str) and pred_remap_note.strip():
        hint_extra_parts.append(pred_remap_note.strip())
    stack_warn = alignment_meta.get("expert_stack_warning")
    if isinstance(stack_warn, str) and stack_warn.strip():
        hint_extra_parts.append(stack_warn.strip())
    if flip_mode != "none":
        hint_extra_parts.append(
            f"In-plane correction applied ({flip_mode}) so expert mask matches CT/AI orientation; "
            f"foreground overlap increased by {flip_gain} voxels."
        )
    hint_extra = " ".join(hint_extra_parts)
    if hint_extra and diagnostics.get("interpretation_hint"):
        diagnostics = {
            **diagnostics,
            "interpretation_hint": f"{diagnostics['interpretation_hint']} {hint_extra}",
        }
    elif hint_extra:
        diagnostics = {**diagnostics, "interpretation_hint": hint_extra}

    if mask_storage is not None:
        mask_storage.mkdir(parents=True, exist_ok=True)
        np.save(mask_storage / f"{study_id}.expert_compare.npy", expert)
        np.save(mask_storage / f"{study_id}.prediction_compare.npy", pred)

    return {
        "study_id": study_id,
        "expert_shape": list(expert.shape),
        "prediction_shape": list(pred.shape),
        "dice": dice,
        "expert_label_max_seen": max_seen_raw,
        "expert_labels_were_clipped": expert_labels_were_clipped,
        "expert_remap_mode": remap_mode,
        "expert_remap_note": remap_note,
        "expert_labels_were_remapped": expert_labels_were_remapped,
        "prediction_remap_mode": pred_remap_mode,
        "prediction_remap_note": pred_remap_note,
        "prediction_labels_were_remapped": prediction_labels_were_remapped,
        "mapping_source": expert_meta.get("mapping_source"),
        "mapping_confidence": expert_meta.get("mapping_confidence"),
        "comparison_scope": expert_meta.get("comparison_scope"),
        "expert_has_ggo": bool(np.any(expert == 1)),
        "expert_has_reticulation": bool(np.any(expert == 2)),
        "expert_has_consolidation": bool(np.any(expert == 3)),
        "prediction_has_ggo": bool(np.any(pred == 1)),
        "prediction_has_reticulation": bool(np.any(pred == 2)),
        "prediction_has_consolidation": bool(np.any(pred == 3)),
        **alignment_meta,
        **diagnostics,
    }


async def run_expert_mask_compare_from_upload(
    *,
    study_id: str,
    mask_storage: Path,
    base_tmp: Path,
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> dict[str, Any]:
    study_id = study_id.strip()
    if not study_id:
        raise HTTPException(status_code=400, detail="study_id is required.")

    mask_path = mask_storage / f"{study_id}.npy"
    if not mask_path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"No prediction mask on disk for study_id={study_id!r}. Run AI analysis first.",
        )

    file, files = _normalize_dicom_upload(file, files)
    session_id = str(uuid.uuid4())
    temp_dir = base_tmp / "tmp" / f"expert-{session_id}"

    try:
        await _materialize_dicom_upload_to_dir(temp_dir, file, files)
        expert_slices = read_sorted_dicom_slices(temp_dir, include_dicom_ext=True)
        if not expert_slices:
            raise HTTPException(
                status_code=400,
                detail="No DICOM files found in the expert mask upload.",
            )

        alignment_meta: dict[str, Any] = {}
        study_dicom_dir = DICOM_STORAGE / study_id
        if study_dicom_dir.is_dir():
            ct_slices = read_sorted_dicom_slices(study_dicom_dir, include_dicom_ext=True)
            if ct_slices:
                expert_vol, align_meta = stack_expert_volume_on_ct_grid(
                    expert_slices, ct_slices
                )
                alignment_meta.update(align_meta)
            else:
                expert_vol = _stack_label_volume_from_sorted_slices(expert_slices)
                alignment_meta["expert_stack_mode"] = "z_sorted_only"
                alignment_meta["expert_stack_warning"] = (
                    "Study CT folder has no DICOMs; expert mask was Z-sorted only."
                )
        else:
            expert_vol = _stack_label_volume_from_sorted_slices(expert_slices)
            alignment_meta["expert_stack_mode"] = "z_sorted_only"
            alignment_meta["expert_stack_warning"] = (
                "Study CT not on disk; expert mask was Z-sorted only (may be L/R flipped)."
            )

        pred = np.load(mask_path).astype(np.uint8)
        return compare_expert_dicom_to_prediction_volume(
            study_id=study_id,
            prediction=pred,
            expert_volume=expert_vol,
            expert_slices=expert_slices,
            mask_storage=mask_storage,
            alignment_meta=alignment_meta,
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
