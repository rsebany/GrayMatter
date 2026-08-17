#!/usr/bin/env python3
"""
3D Slicer bridge client (backward-compatible wrapper).

Prefer ``slicer_connect.py`` for pull/push/watch/status. This script delegates push/watch
to ``slicer_connect`` with JWT auth via ``BEARER_TOKEN`` or ``--token``.

Labels: 0=background, 1=left hippocampus, 2=right hippocampus (uint8 [Z,Y,X]).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.paths import default_api_base
from integrations import slicer_connect


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Push Slicer-edited hippocampus segmentation to GrayMatter (legacy wrapper)."
    )
    parser.add_argument("--api-base", default=default_api_base())
    parser.add_argument("--token", default=None, help="JWT (default: BEARER_TOKEN env)")
    parser.add_argument("--urllib", action="store_true")
    parser.add_argument("--study-id", required=True)
    parser.add_argument("--mask-npy", required=True)
    parser.add_argument("--spacing", default="1,1,1")
    parser.add_argument("--note", default="slicer live edit")
    parser.add_argument("--watch", action="store_true")
    parser.add_argument("--debounce-ms", type=int, default=700)
    args = parser.parse_args()

    argv = [
        "slicer_connect",
        "--api-base",
        args.api_base,
        "--spacing",
        args.spacing,
        "--note",
        args.note,
    ]
    if args.token:
        argv.extend(["--token", args.token])
    if args.urllib:
        argv.append("--urllib")
    if args.watch:
        argv.extend(
            [
                "watch",
                "--study-id",
                args.study_id,
                "--mask-npy",
                args.mask_npy,
                "--debounce-ms",
                str(args.debounce_ms),
            ]
        )
    else:
        argv.extend(
            [
                "push",
                "--study-id",
                args.study_id,
                "--mask-npy",
                args.mask_npy,
            ]
        )

    old_argv = sys.argv
    try:
        sys.argv = argv
        return slicer_connect.main()
    finally:
        sys.argv = old_argv


if __name__ == "__main__":
    raise SystemExit(main())
