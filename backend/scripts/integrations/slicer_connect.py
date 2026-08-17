#!/usr/bin/env python3
"""GrayMatter <-> 3D Slicer round-trip CLI (pull / push / watch / status)."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.api_client import ApiClient, default_api_base
from common.segmentation_sync import build_revision_payload, parse_spacing_zyx
from integrations.slicer_pull import pull_study_workspace

__all__ = ["push_mask_revision", "read_mask"]


def read_mask(mask_path: Path) -> np.ndarray:
    arr = np.load(mask_path).astype(np.uint8)
    if arr.ndim != 3:
        raise ValueError("Mask must be a 3D uint8 array in [Z,Y,X].")
    return arr


def push_mask_revision(
    client: ApiClient,
    study_id: str,
    mask: np.ndarray,
    spacing: tuple[float, float, float],
    *,
    note: str = "slicer live edit",
    source: str = "slicer_bridge",
) -> dict[str, Any]:
    payload = build_revision_payload(mask, spacing, source=source, revision_note=note)
    token_response = client.post_json("/auth/slicer-token", {"study_id": study_id})
    integration_token = str(token_response.get("access_token") or "").strip()
    if not integration_token:
        raise RuntimeError("Slicer token response did not include an access token.")
    scoped_client = ApiClient(
        client.api_base,
        token=integration_token,
        use_urllib=client.use_urllib,
        timeout_s=client.timeout_s,
    )
    return scoped_client.post_json(
        f"/studies/{study_id}/segmentation-revisions", payload
    )


def cmd_pull(args: argparse.Namespace) -> int:
    client = ApiClient(
        args.api_base,
        token=args.token,
        use_urllib=args.urllib,
        timeout_s=args.timeout,
    )
    manifest = pull_study_workspace(client, args.study_id, Path(args.out_dir))
    print(json.dumps(manifest, indent=2))
    return 0


def cmd_push(args: argparse.Namespace) -> int:
    client = ApiClient(
        args.api_base,
        token=args.token,
        use_urllib=args.urllib,
        timeout_s=args.timeout,
    )
    mask_path = Path(args.mask_npy)
    if not mask_path.is_file():
        print(f"[ERROR] Mask not found: {mask_path}")
        return 1
    spacing = parse_spacing_zyx(args.spacing)
    mask = read_mask(mask_path)
    result = push_mask_revision(
        client,
        args.study_id,
        mask,
        spacing,
        note=args.note,
        source=args.source,
    )
    print(json.dumps(result, indent=2))
    return 0


def cmd_watch(args: argparse.Namespace) -> int:
    client = ApiClient(
        args.api_base,
        token=args.token,
        use_urllib=args.urllib,
        timeout_s=args.timeout,
    )
    mask_path = Path(args.mask_npy)
    if not mask_path.is_file():
        print(f"[ERROR] Mask not found: {mask_path}")
        return 1
    spacing = parse_spacing_zyx(args.spacing)
    print(f"[connect] watching {mask_path} for changes...")
    last_mtime = 0.0
    while True:
        try:
            mtime = mask_path.stat().st_mtime
            if mtime > last_mtime:
                last_mtime = mtime
                time.sleep(max(args.debounce_ms, 100) / 1000.0)
                mask = read_mask(mask_path)
                result = push_mask_revision(
                    client,
                    args.study_id,
                    mask,
                    spacing,
                    note=args.note,
                    source=args.source,
                )
                print(
                    f"[connect] pushed revision={result.get('revision_id')} "
                    f"mesh={result.get('mesh_url')} stl={result.get('stl_url')}"
                )
        except KeyboardInterrupt:
            print("[connect] stopped")
            break
        except Exception as exc:  # noqa: BLE001
            print(f"[connect] error: {exc}")
            time.sleep(1.0)
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    client = ApiClient(
        args.api_base,
        token=args.token,
        use_urllib=args.urllib,
        timeout_s=args.timeout,
    )
    result = client.get_json(f"/studies/{args.study_id}/segmentation-sync/status")
    print(json.dumps(result, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="GrayMatter <-> 3D Slicer round-trip (pull imaging, push segmentation revisions)."
    )
    parser.add_argument(
        "--api-base",
        default=default_api_base(),
        help="API root (e.g. http://localhost/api or http://127.0.0.1:8000)",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="JWT bearer token (default: BEARER_TOKEN env)",
    )
    parser.add_argument(
        "--urllib",
        action="store_true",
        help="Use stdlib HTTP (3D Slicer embedded Python without requests)",
    )
    parser.add_argument("--timeout", type=int, default=120)

    sub = parser.add_subparsers(dest="command", required=True)

    pull_p = sub.add_parser("pull", help="Download DICOM + mask + geometry into a workspace folder")
    pull_p.add_argument("--study-id", required=True)
    pull_p.add_argument(
        "--out-dir",
        required=True,
        help="Output directory (e.g. ./slicer_workspace/ST-abc12345)",
    )
    pull_p.set_defaults(func=cmd_pull)

    for name in ("push", "watch"):
        p = sub.add_parser(name, help="Push mask .npy revision to server" if name == "push" else "Watch mask file and push on change")
        p.add_argument("--study-id", required=True)
        p.add_argument("--mask-npy", required=True, help="[Z,Y,X] uint8 labelmap .npy")
        p.add_argument("--spacing", default="1,1,1", help="Voxel spacing mm as z,y,x")
        p.add_argument("--note", default="slicer live edit")
        p.add_argument("--source", default="slicer_bridge")
        if name == "watch":
            p.add_argument("--debounce-ms", type=int, default=700)
            p.set_defaults(func=cmd_watch)
        else:
            p.set_defaults(func=cmd_push)

    status_p = sub.add_parser("status", help="GET segmentation-sync status")
    status_p.add_argument("--study-id", required=True)
    status_p.set_defaults(func=cmd_status)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
