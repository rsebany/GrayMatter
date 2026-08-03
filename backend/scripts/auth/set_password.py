#!/usr/bin/env python3
"""Set or reset a practitioner's password by email (CLI only)."""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.users_cli import set_user_password


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update password hash for an existing user (by email)."
    )
    parser.add_argument("--email", required=True, help="User email.")
    parser.add_argument(
        "--password",
        help="New plain password (max 72 bytes). Omit to prompt securely.",
    )
    return parser.parse_args()


def _read_password(args: argparse.Namespace) -> str:
    if args.password:
        return args.password
    first = getpass.getpass("New password: ")
    second = getpass.getpass("Confirm new password: ")
    if first != second:
        print("[ERROR] Passwords do not match.", file=sys.stderr)
        raise SystemExit(1)
    if not first:
        print("[ERROR] Password cannot be empty.", file=sys.stderr)
        raise SystemExit(1)
    return first


def main() -> int:
    args = parse_args()
    password = _read_password(args)
    user = set_user_password(email=args.email.strip().lower(), password=password)
    print(f"[OK] Password updated for {user.email} (id={user.id}, role={user.role})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
