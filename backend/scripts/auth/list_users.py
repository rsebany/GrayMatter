#!/usr/bin/env python3
"""List practitioner accounts (no password hashes)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.users_cli import format_created_at, iter_users


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="List users in the database.")
    parser.add_argument(
        "--format",
        choices=("table", "json"),
        default="table",
        help="Output format (default: table).",
    )
    return parser.parse_args()


def _print_table() -> None:
    rows = list(iter_users())
    if not rows:
        print("(no users)")
        return
    headers = ("id", "medical_id", "full_name", "email", "role", "created_at")
    data = [
        (
            str(u.id),
            u.medical_id,
            u.full_name,
            u.email,
            u.role,
            format_created_at(u.created_at),
        )
        for u in rows
    ]
    widths = [len(h) for h in headers]
    for row in data:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(cell))
    fmt = "  ".join(f"{{:{w}}}" for w in widths)
    print(fmt.format(*headers))
    print(fmt.format(*["-" * w for w in widths]))
    for row in data:
        print(fmt.format(*row))
    print(f"\n{len(rows)} user(s)")


def _print_json() -> None:
    payload = [
        {
            "id": u.id,
            "medical_id": u.medical_id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in iter_users()
    ]
    print(json.dumps(payload, indent=2))


def main() -> int:
    args = parse_args()
    if args.format == "json":
        _print_json()
    else:
        _print_table()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
