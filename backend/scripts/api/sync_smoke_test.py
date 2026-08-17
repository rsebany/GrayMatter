#!/usr/bin/env python3
"""Smoke test POST /studies/{id}/segmentation-revisions with JWT and study geometry."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import requests

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.api_client import ApiClient, default_api_base, resolve_bearer_token
from common.segmentation_sync import build_revision_payload


def make_mask(shape: tuple[int, int, int]) -> np.ndarray:
    z, y, x = shape
    arr = np.zeros(shape, dtype=np.uint8)
    arr[z // 4 : z // 2, y // 4 : y // 2, x // 4 : x // 2] = 1
    arr[z // 2 : (3 * z) // 4, y // 3 : (2 * y) // 3, x // 3 : (2 * x) // 3] = 2
    return arr


def fetch_geometry(api_base: str, study_id: str, token: str) -> tuple[tuple[int, int, int], tuple[float, float, float]]:
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{api_base.rstrip('/')}/studies/{study_id}/dicom-shape"
    resp = requests.get(url, headers=headers, timeout=60)
    if not resp.ok:
        raise RuntimeError(f"GET dicom-shape failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    shape = (
        int(data["depth"]),
        int(data["height"]),
        int(data["width"]),
    )
    spacing = (
        float(data["spacing_z_mm"]),
        float(data["spacing_y_mm"]),
        float(data["spacing_x_mm"]),
    )
    return shape, spacing


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Smoke test Slicer sync endpoint with auth and real study geometry."
    )
    parser.add_argument("--api-base", default=default_api_base())
    parser.add_argument("--study-id", required=True)
    parser.add_argument("--token", default=None, help="JWT (default: BEARER_TOKEN env)")
    parser.add_argument("--shape", default=None, help="Override z,y,x (default: from dicom-shape)")
    parser.add_argument("--spacing", default=None, help="Override z,y,x mm (default: from dicom-shape)")
    args = parser.parse_args()

    token = resolve_bearer_token(args.token)
    if args.shape and args.spacing:
        shape = tuple(int(x) for x in args.shape.split(","))
        spacing = tuple(float(x) for x in args.spacing.split(","))
    else:
        shape, spacing = fetch_geometry(args.api_base, args.study_id, token)

    mask = make_mask(shape)
    payload = build_revision_payload(
        mask,
        spacing,
        source="manual",
        revision_note="sync smoke test",
    )

    client = ApiClient(args.api_base, token=token, timeout_s=180)
    token_response = client.post_json(
        "/auth/slicer-token",
        {"study_id": args.study_id},
    )
    integration_token = str(token_response.get("access_token") or "").strip()
    if not integration_token:
        raise RuntimeError("Slicer token response did not include an access token.")
    scoped_client = ApiClient(
        args.api_base,
        token=integration_token,
        timeout_s=180,
    )
    t0 = time.perf_counter()
    result = scoped_client.post_json(
        f"/studies/{args.study_id}/segmentation-revisions",
        payload,
    )
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    print(f"OK in {elapsed_ms} ms")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
