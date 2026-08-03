#!/usr/bin/env python3
"""POST a local ZIP to /studies/upload (requires BEARER_TOKEN)."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import requests

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.paths import BACKEND_API_DIR, default_api_base


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Smoke test authenticated study upload (ZIP or DICOM archive)."
    )
    parser.add_argument(
        "--zip",
        type=Path,
        default=BACKEND_API_DIR / "tmp" / "118" / "scan_118_download.zip",
        help="Path to the zip file to upload.",
    )
    parser.add_argument(
        "--api-base",
        default=default_api_base(),
        help="API root URL (default: ILD_API_BASE_URL / NEXT_PUBLIC_API_BASE_URL / 127.0.0.1:8000).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Request timeout in seconds (default: 600).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    zip_path = args.zip.resolve()

    if not zip_path.is_file():
        print(f"[ERROR] ZIP not found at {zip_path}")
        return 1

    token = os.environ.get("BEARER_TOKEN", "").strip()
    if not token:
        print(
            "[ERROR] Set BEARER_TOKEN to a valid JWT (same as the browser session) "
            "to call /studies/upload."
        )
        return 1

    url = f"{args.api_base.rstrip('/')}/studies/upload"
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[INFO] Sending {zip_path.name} to {url} ...")

    try:
        with zip_path.open("rb") as handle:
            files = {"file": (zip_path.name, handle, "application/zip")}
            resp = requests.post(url, files=files, headers=headers, timeout=args.timeout)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Request failed: {exc}")
        return 1

    print(f"[INFO] Status: {resp.status_code}")
    try:
        print(resp.json())
    except Exception:  # noqa: BLE001
        print(resp.text)
    return 0 if resp.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
