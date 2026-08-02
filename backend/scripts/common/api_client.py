"""Authenticated HTTP helpers for GrayMatter CLI / Slicer scripts."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from common.paths import default_api_base

__all__ = [
    "ApiClient",
    "auth_headers",
    "default_api_base",
    "resolve_bearer_token",
]


def resolve_bearer_token(token: str | None = None) -> str:
    """Return JWT from explicit arg or ``BEARER_TOKEN`` env."""
    value = (token or os.environ.get("BEARER_TOKEN", "")).strip()
    if not value:
        raise RuntimeError(
            "Authentication required. Set BEARER_TOKEN or pass --token "
            "(login via POST /auth/login or copy JWT from browser session)."
        )
    return value


def auth_headers(token: str | None = None) -> dict[str, str]:
    bearer = resolve_bearer_token(token)
    return {
        "Authorization": f"Bearer {bearer}",
        "Content-Type": "application/json; charset=utf-8",
    }


class ApiClient:
    """Thin wrapper around requests with urllib fallback."""

    def __init__(
        self,
        api_base: str | None = None,
        *,
        token: str | None = None,
        use_urllib: bool = False,
        timeout_s: int = 120,
    ) -> None:
        self.api_base = (api_base or default_api_base()).rstrip("/")
        self.token = token
        self.use_urllib = use_urllib
        self.timeout_s = timeout_s

    def _url(self, path: str) -> str:
        path = path if path.startswith("/") else f"/{path}"
        return f"{self.api_base}{path}"

    def get_json(self, path: str) -> dict[str, Any]:
        if self.use_urllib:
            return self._get_json_urllib(path)
        return self._get_json_requests(path)

    def get_blob(self, path: str) -> bytes:
        if self.use_urllib:
            return self._get_blob_urllib(path)
        return self._get_blob_requests(path)

    def get_blob_with_headers(self, path: str) -> tuple[bytes, dict[str, str]]:
        if self.use_urllib:
            return self._get_blob_with_headers_urllib(path)
        return self._get_blob_with_headers_requests(path)

    def post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        if self.use_urllib:
            return self._post_json_urllib(path, payload)
        return self._post_json_requests(path, payload)

    def _headers(self, *, json_body: bool = True) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {resolve_bearer_token(self.token)}"}
        if json_body:
            headers["Content-Type"] = "application/json; charset=utf-8"
        return headers

    def _get_json_requests(self, path: str) -> dict[str, Any]:
        import requests

        resp = requests.get(
            self._url(path),
            headers=self._headers(json_body=False),
            timeout=self.timeout_s,
        )
        if not resp.ok:
            raise RuntimeError(f"GET {path} failed ({resp.status_code}): {resp.text}")
        return resp.json()

    def _get_blob_requests(self, path: str) -> bytes:
        import requests

        resp = requests.get(
            self._url(path),
            headers=self._headers(json_body=False),
            timeout=self.timeout_s,
        )
        if not resp.ok:
            raise RuntimeError(f"GET {path} failed ({resp.status_code}): {resp.text}")
        return resp.content

    def _get_blob_with_headers_requests(self, path: str) -> tuple[bytes, dict[str, str]]:
        import requests

        resp = requests.get(
            self._url(path),
            headers=self._headers(json_body=False),
            timeout=self.timeout_s,
        )
        if not resp.ok:
            raise RuntimeError(f"GET {path} failed ({resp.status_code}): {resp.text}")
        return resp.content, {k: v for k, v in resp.headers.items()}

    def _post_json_requests(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        import requests

        resp = requests.post(
            self._url(path),
            json=payload,
            headers=self._headers(),
            timeout=self.timeout_s,
        )
        if not resp.ok:
            raise RuntimeError(f"POST {path} failed ({resp.status_code}): {resp.text}")
        return resp.json()

    def _get_json_urllib(self, path: str) -> dict[str, Any]:
        req = urllib.request.Request(
            self._url(path),
            headers=self._headers(json_body=False),
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_s) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            err = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"GET {path} failed ({exc.code}): {err}") from exc

    def _get_blob_urllib(self, path: str) -> bytes:
        data, _ = self._get_blob_with_headers_urllib(path)
        return data

    def _get_blob_with_headers_urllib(self, path: str) -> tuple[bytes, dict[str, str]]:
        req = urllib.request.Request(
            self._url(path),
            headers=self._headers(json_body=False),
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_s) as resp:
                headers = {k.lower(): v for k, v in resp.headers.items()}
                return resp.read(), headers
        except urllib.error.HTTPError as exc:
            err = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"GET {path} failed ({exc.code}): {err}") from exc

    def _post_json_urllib(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self._url(path),
            data=body,
            headers=self._headers(),
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_s) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            err = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"POST {path} failed ({exc.code}): {err}") from exc
