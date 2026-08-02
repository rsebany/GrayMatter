#!/usr/bin/env python3
"""Create a practitioner account in PostgreSQL (password set via CLI only)."""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.users_cli import VALID_ROLES, create_user_record, validate_role


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a practitioner user (email, role, bcrypt password hash in DB)."
    )
    parser.add_argument("--email", required=True, help="Login email (unique).")
    parser.add_argument("--full-name", required=True, help="Display name.")
    parser.add_argument(
        "--role",
        default="radiologist",
        choices=VALID_ROLES,
        help=f"Role (default: radiologist). Options: {', '.join(VALID_ROLES)}",
    )
    parser.add_argument(
        "--password",
        help="Plain password (max 72 bytes). Omit to prompt securely.",
    )
    return parser.parse_args()


def _read_password(args: argparse.Namespace) -> str:
    if args.password:
        return args.password
    first = getpass.getpass("Password: ")
    second = getpass.getpass("Confirm password: ")
    if first != second:
        print("[ERROR] Passwords do not match.", file=sys.stderr)
        raise SystemExit(1)
    if not first:
        print("[ERROR] Password cannot be empty.", file=sys.stderr)
        raise SystemExit(1)
    return first


def main() -> int:
    args = parse_args()
    role = validate_role(args.role)
    password = _read_password(args)
    user = create_user_record(
        email=args.email,
        full_name=args.full_name,
        role=role,
        password=password,
    )
    print(f"[OK] Created user id={user.id} medical_id={user.medical_id} role={user.role}")
    print(f"     email={user.email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
