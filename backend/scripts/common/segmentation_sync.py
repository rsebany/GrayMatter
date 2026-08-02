"""Payload helpers for POST /studies/{id}/segmentation-revisions."""
from __future__ import annotations

import base64
from typing import Any

import numpy as np

HIPPO_LABELS: dict[str, int] = {
    "background": 0,
    "left": 1,
    "right": 2,
}


def parse_spacing_zyx(spec: str) -> tuple[float, float, float]:
    parts = [float(x.strip()) for x in spec.split(",")]
    if len(parts) != 3:
        raise ValueError("spacing must have exactly 3 values: z,y,x")
    return (parts[0], parts[1], parts[2])


def parse_shape_zyx(spec: str) -> tuple[int, int, int]:
    parts = [int(x.strip()) for x in spec.split(",")]
    if len(parts) != 3:
        raise ValueError("shape must have exactly 3 values: z,y,x")
    return (parts[0], parts[1], parts[2])


def encode_mask_b64(mask: np.ndarray) -> str:
    return base64.b64encode(np.asarray(mask, dtype=np.uint8).tobytes()).decode("ascii")


def build_revision_payload(
    mask: np.ndarray,
    spacing_zyx: tuple[float, float, float],
    *,
    source: str,
    revision_note: str | None,
) -> dict[str, Any]:
    return {
        "source": source,
        "revision_note": revision_note,
        "geometry": {
            "shape_zyx": [int(v) for v in mask.shape],
            "spacing_zyx_mm": [float(v) for v in spacing_zyx],
            "orientation": "zyx",
        },
        "labels": dict(HIPPO_LABELS),
        "mask_b64": encode_mask_b64(mask),
    }
