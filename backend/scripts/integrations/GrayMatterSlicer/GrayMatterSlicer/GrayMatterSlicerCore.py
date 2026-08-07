"""Pure-Python transport, workspace, and validation helpers for GrayMatter Slicer."""
from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import re
import tempfile
import shutil
import math
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Sequence, Tuple

import numpy as np

ALLOWED_LABELS = frozenset((0, 1, 2))
LABELS = {"background": 0, "left": 1, "right": 2}
LABEL_NAMES = {1: "Left hippocampus", 2: "Right hippocampus"}
LABEL_COLORS = {1: (0.90, 0.22, 0.22), 2: (0.20, 0.45, 0.92)}
SECRET_KEYS = frozenset(("token", "access_token", "bearer_token", "password", "authorization"))
SPACING_TOLERANCE_MM = 0.01
STUDY_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
MAX_DICOM_ZIP_FILES = 20000
MAX_DICOM_ZIP_BYTES = 4 * 1024 * 1024 * 1024
WINDOWS_CREDENTIAL_TARGET = "GrayMatter:3DSlicerSession"


def normalize_api_base(value: str) -> str:
    base = value.strip().rstrip("/")
    if len(base) > 2048:
        raise ValueError("API base is too long.")
    if not base.startswith(("http://", "https://")):
        raise ValueError("API base must begin with http:// or https://.")
    parsed = urllib.parse.urlsplit(base)
    if not parsed.hostname or parsed.fragment:
        raise ValueError("API base must include a host and must not include a fragment.")
    if parsed.username or parsed.password:
        raise ValueError("API base must not contain credentials.")
    query_keys = {key.lower() for key, _ in urllib.parse.parse_qsl(parsed.query)}
    if query_keys & SECRET_KEYS:
        raise ValueError("API base must not contain credentials in its query string.")
    if parsed.query:
        raise ValueError("API base must not contain a query string.")
    return base


def credential_manager_available() -> bool:
    return os.name == "nt"


def _encode_saved_session(api_base: str, email: str, token: str) -> bytes:
    if not token.strip():
        raise ValueError("A session token is required.")
    payload = {
        "api_base": normalize_api_base(api_base),
        "email": email.strip(),
        "token": token.strip(),
    }
    return json.dumps(payload, separators=(",", ":")).encode("utf-8")


def _decode_saved_session(raw: bytes) -> Dict[str, str]:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise ValueError("Saved GrayMatter credential is invalid.") from exc
    if not isinstance(payload, dict):
        raise ValueError("Saved GrayMatter credential is invalid.")
    api_base = normalize_api_base(str(payload.get("api_base") or ""))
    token = str(payload.get("token") or "").strip()
    if not token:
        raise ValueError("Saved GrayMatter credential has no session token.")
    return {
        "api_base": api_base,
        "email": str(payload.get("email") or "").strip(),
        "token": token,
    }


def _credential_api():
    if not credential_manager_available():
        raise RuntimeError("Windows Credential Manager is only available on Windows.")

    import ctypes
    from ctypes import wintypes

    class CREDENTIALW(ctypes.Structure):
        _fields_ = [
            ("Flags", wintypes.DWORD),
            ("Type", wintypes.DWORD),
            ("TargetName", wintypes.LPWSTR),
            ("Comment", wintypes.LPWSTR),
            ("LastWritten", wintypes.FILETIME),
            ("CredentialBlobSize", wintypes.DWORD),
            ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
            ("Persist", wintypes.DWORD),
            ("AttributeCount", wintypes.DWORD),
            ("Attributes", wintypes.LPVOID),
            ("TargetAlias", wintypes.LPWSTR),
            ("UserName", wintypes.LPWSTR),
        ]

    api = ctypes.WinDLL("Advapi32.dll", use_last_error=True)
    api.CredWriteW.argtypes = [ctypes.POINTER(CREDENTIALW), wintypes.DWORD]
    api.CredWriteW.restype = wintypes.BOOL
    api.CredReadW.argtypes = [
        wintypes.LPCWSTR,
        wintypes.DWORD,
        wintypes.DWORD,
        ctypes.POINTER(ctypes.POINTER(CREDENTIALW)),
    ]
    api.CredReadW.restype = wintypes.BOOL
    api.CredDeleteW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD]
    api.CredDeleteW.restype = wintypes.BOOL
    api.CredFree.argtypes = [wintypes.LPVOID]
    api.CredFree.restype = None
    return ctypes, CREDENTIALW, api


def save_session_credential(api_base: str, email: str, token: str) -> None:
    """Store the normal session token as a Windows generic credential."""
    ctypes, credential_type, api = _credential_api()
    raw = _encode_saved_session(api_base, email, token)
    blob = (ctypes.c_ubyte * len(raw)).from_buffer_copy(raw)
    credential = credential_type()
    credential.Type = 1  # CRED_TYPE_GENERIC
    credential.TargetName = WINDOWS_CREDENTIAL_TARGET
    credential.Comment = "GrayMatter 3D Slicer remembered session"
    credential.CredentialBlobSize = len(raw)
    credential.CredentialBlob = ctypes.cast(blob, ctypes.POINTER(ctypes.c_ubyte))
    credential.Persist = 2  # CRED_PERSIST_LOCAL_MACHINE
    credential.UserName = email.strip() or "GrayMatter user"
    if not api.CredWriteW(ctypes.byref(credential), 0):
        raise ctypes.WinError(ctypes.get_last_error())


def load_session_credential() -> Optional[Dict[str, str]]:
    """Load the remembered session, or return None when none is stored."""
    ctypes, credential_type, api = _credential_api()
    pointer = ctypes.POINTER(credential_type)()
    if not api.CredReadW(
        WINDOWS_CREDENTIAL_TARGET,
        1,  # CRED_TYPE_GENERIC
        0,
        ctypes.byref(pointer),
    ):
        error = ctypes.get_last_error()
        if error == 1168:  # ERROR_NOT_FOUND
            return None
        raise ctypes.WinError(error)
    try:
        credential = pointer.contents
        raw = ctypes.string_at(
            credential.CredentialBlob,
            credential.CredentialBlobSize,
        )
        return _decode_saved_session(raw)
    finally:
        api.CredFree(pointer)


def delete_session_credential() -> None:
    """Remove the remembered GrayMatter session if present."""
    ctypes, _credential_type, api = _credential_api()
    if not api.CredDeleteW(WINDOWS_CREDENTIAL_TARGET, 1, 0):
        error = ctypes.get_last_error()
        if error != 1168:  # ERROR_NOT_FOUND
            raise ctypes.WinError(error)


def _url(api_base: str, path: str) -> str:
    return normalize_api_base(api_base) + (path if path.startswith("/") else "/" + path)


def _request(
    api_base: str,
    path: str,
    token: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    timeout_s: int = 180,
) -> Tuple[bytes, Dict[str, str]]:
    headers = {"Accept": "application/json"}
    if token and token.strip():
        headers["Authorization"] = "Bearer " + token.strip()
    data = None
    method = "GET"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
        method = "POST"
    request = urllib.request.Request(
        _url(api_base, path), data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_s) as response:
            response_headers = {key.lower(): value for key, value in response.headers.items()}
            return response.read(), response_headers
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            "{} {} failed ({}): {}".format(method, path, exc.code, detail)
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError("{} {} failed: {}".format(method, path, exc.reason)) from exc


def request_json(
    api_base: str,
    path: str,
    token: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    raw, _ = _request(api_base, path, token=token, payload=payload)
    result = json.loads(raw.decode("utf-8"))
    if not isinstance(result, dict):
        raise ValueError("Expected a JSON object from {}.".format(path))
    return result


def login(api_base: str, email: str, password: str) -> Tuple[str, Dict[str, Any]]:
    if not email.strip() or not password:
        raise ValueError("Email and password are required.")
    result = request_json(
        api_base,
        "/auth/login",
        payload={"email": email.strip(), "password": password},
    )
    token = str(result.get("access_token") or "").strip()
    if not token:
        raise RuntimeError("Login response did not include an access token.")
    return token, dict(result.get("user") or {})


def issue_slicer_token(api_base: str, study_id: str, access_token: str) -> str:
    """Exchange a normal session token for an ephemeral, study-scoped write token."""
    study_id = validate_study_id(study_id)
    result = request_json(
        api_base,
        "/auth/slicer-token",
        token=access_token,
        payload={"study_id": study_id},
    )
    token = str(result.get("access_token") or "").strip()
    if not token:
        raise RuntimeError("Slicer token response did not include an access token.")
    return token


def validate_study_id(study_id: str) -> str:
    value = study_id.strip()
    if not STUDY_ID_PATTERN.fullmatch(value):
        raise ValueError("Study ID contains unsupported characters or is too long.")
    return value


def _safe_extract_zip(raw: bytes, destination: Path) -> None:
    destination = destination.resolve()
    total_size = 0
    with zipfile.ZipFile(BytesIO(raw)) as archive:
        members = archive.infolist()
        if len(members) > MAX_DICOM_ZIP_FILES:
            raise ValueError("DICOM ZIP contains too many files.")
        staging = Path(
            tempfile.mkdtemp(prefix=".dicom-", dir=str(destination.parent.resolve()))
        )
        try:
            for member in members:
                total_size += int(member.file_size)
                if total_size > MAX_DICOM_ZIP_BYTES:
                    raise ValueError("DICOM ZIP is too large after extraction.")
                if member.flag_bits & 0x1:
                    raise ValueError("Encrypted DICOM ZIP entries are not supported.")
                mode = (member.external_attr >> 16) & 0o170000
                if mode == 0o120000:
                    raise ValueError("DICOM ZIP must not contain symbolic links.")
                target = (staging / member.filename).resolve()
                try:
                    target.relative_to(staging)
                except ValueError as exc:
                    raise ValueError("DICOM ZIP contains an unsafe path.") from exc
                if member.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member, "r") as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output, length=1024 * 1024)
            backup = destination.with_name(destination.name + ".previous")
            if backup.exists():
                shutil.rmtree(str(backup), ignore_errors=True)
            had_destination = destination.exists()
            if had_destination:
                os.replace(str(destination), str(backup))
            try:
                os.replace(str(staging), str(destination))
            except Exception:
                if had_destination and backup.exists():
                    os.replace(str(backup), str(destination))
                raise
            shutil.rmtree(str(backup), ignore_errors=True)
        except Exception:
            shutil.rmtree(str(staging), ignore_errors=True)
            raise


def _mask_from_response(raw: bytes, headers: Dict[str, str]) -> np.ndarray:
    shape_text = headers.get("x-mask-shape", "")
    try:
        shape = tuple(int(value.strip()) for value in shape_text.split(","))
    except ValueError as exc:
        raise ValueError("Invalid X-Mask-Shape response header.") from exc
    if len(shape) != 3 or any(value <= 0 for value in shape):
        raise ValueError("Missing or invalid X-Mask-Shape response header.")
    expected_bytes = int(np.prod(shape))
    if len(raw) != expected_bytes:
        raise ValueError(
            "Mask response has {} bytes; geometry requires {}.".format(len(raw), expected_bytes)
        )
    return np.frombuffer(raw, dtype=np.uint8).reshape(shape).copy()


def geometry_from_manifest(manifest: Dict[str, Any]) -> Tuple[Tuple[int, int, int], Tuple[float, float, float]]:
    shape = tuple(int(value) for value in manifest.get("shape_zyx", ()))
    spacing = tuple(float(value) for value in manifest.get("spacing_zyx_mm", ()))
    if len(shape) != 3 or any(value <= 0 for value in shape):
        raise ValueError("Workspace manifest has invalid shape_zyx.")
    if len(spacing) != 3 or any(value <= 0 for value in spacing):
        raise ValueError("Workspace manifest has invalid spacing_zyx_mm.")
    return shape, spacing


def slicer_geometry_from_manifest(
    manifest: Dict[str, Any],
) -> Tuple[Tuple[int, int, int], Tuple[float, float, float]]:
    """Return array geometry as exposed by Slicer's KJI numpy helpers.

    GrayMatter's legacy NIfTI loader stores nibabel's XYZ array without
    transposing it, while Slicer exposes that same volume to numpy as ZYX.
    DICOM data is already normalized to ZYX on the server.
    """
    shape, spacing = geometry_from_manifest(manifest)
    if manifest.get("imaging_source") == "nifti":
        return tuple(reversed(shape)), tuple(reversed(spacing))
    return shape, spacing


def mask_to_slicer_order(mask: np.ndarray, manifest: Dict[str, Any]) -> np.ndarray:
    """Convert a server mask to Slicer's numpy array order."""
    server_shape, _ = geometry_from_manifest(manifest)
    if tuple(mask.shape) != server_shape:
        raise ValueError(
            "Mask shape {} does not match server geometry {}.".format(
                mask.shape, server_shape
            )
        )
    if manifest.get("imaging_source") == "nifti":
        return np.transpose(mask, (2, 1, 0)).copy()
    return mask.copy()


def mask_from_slicer_order(mask: np.ndarray, manifest: Dict[str, Any]) -> np.ndarray:
    """Convert a Slicer-edited mask back to the server's stored array order."""
    slicer_shape, _ = slicer_geometry_from_manifest(manifest)
    if tuple(mask.shape) != slicer_shape:
        raise ValueError(
            "Slicer mask shape {} does not match reference geometry {}.".format(
                mask.shape, slicer_shape
            )
        )
    if manifest.get("imaging_source") == "nifti":
        return np.transpose(mask, (2, 1, 0)).copy()
    return mask.copy()


def assert_no_secrets(value: Any, path: str = "manifest") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if str(key).lower() in SECRET_KEYS:
                raise ValueError("{} must not contain secret field {!r}.".format(path, key))
            assert_no_secrets(child, path + "." + str(key))
    elif isinstance(value, (list, tuple)):
        for index, child in enumerate(value):
            assert_no_secrets(child, "{}[{}]".format(path, index))


def write_manifest(path: Path, manifest: Dict[str, Any]) -> None:
    assert_no_secrets(manifest)
    _atomic_write_bytes(path, json.dumps(manifest, indent=2).encode("utf-8"))


def _atomic_write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(
        dir=str(path.parent), prefix="." + path.name + ".", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, str(path))
    except Exception:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise


def _atomic_save_array(path: Path, array: np.ndarray) -> None:
    descriptor, temporary = tempfile.mkstemp(
        dir=str(path.parent), prefix="." + path.name + ".", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "wb") as output:
            np.save(output, array, allow_pickle=False)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, str(path))
    except Exception:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise


def pull_workspace(
    api_base: str, study_id: str, token: str, workspace: Path
) -> Dict[str, Any]:
    study_id = validate_study_id(study_id)
    if not token.strip():
        raise ValueError("A bearer token or login is required.")
    workspace = Path(workspace).expanduser().resolve()
    workspace.mkdir(parents=True, exist_ok=True)

    geometry = request_json(api_base, "/studies/{}/dicom-shape".format(study_id), token)
    mask_raw, mask_headers = _request(
        api_base, "/studies/{}/mask".format(study_id), token=token
    )
    mask = _mask_from_response(mask_raw, mask_headers)
    validate_allowed_labels(mask)
    shape = (
        int(geometry.get("depth", mask.shape[0])),
        int(geometry.get("height", mask.shape[1])),
        int(geometry.get("width", mask.shape[2])),
    )
    spacing = (
        float(geometry.get("spacing_z_mm", 1.0)),
        float(geometry.get("spacing_y_mm", 1.0)),
        float(geometry.get("spacing_x_mm", 1.0)),
    )
    if shape != tuple(mask.shape):
        raise ValueError(
            "Server geometry shape {} does not match mask shape {}.".format(shape, mask.shape)
        )

    dicom_dir = workspace / "dicom"
    imaging_source = "unknown"
    imaging_note = ""
    nifti_path = None
    try:
        dicom_raw, _ = _request(
            api_base, "/studies/{}/dicom-zip".format(study_id), token=token
        )
        _safe_extract_zip(dicom_raw, dicom_dir)
        if any(path.is_file() for path in dicom_dir.rglob("*")):
            imaging_source = "dicom"
        else:
            imaging_note = "DICOM archive contained no files."
    except Exception:
        imaging_note = "DICOM unavailable."

    if imaging_source != "dicom":
        try:
            nifti_raw, nifti_headers = _request(
                api_base, "/studies/{}/nifti".format(study_id), token=token
            )
            disposition = nifti_headers.get("content-disposition", "")
            filename = "volume.nii.gz"
            if "filename=" in disposition:
                candidate = Path(
                    disposition.split("filename=", 1)[1].strip().strip('"')
                ).name
                if candidate.endswith((".nii", ".nii.gz")):
                    filename = candidate
            nifti_path = workspace / filename
            _atomic_write_bytes(nifti_path, nifti_raw)
            imaging_source = "nifti"
        except Exception:
            imaging_note += " NIfTI unavailable."

    mask_path = workspace / "ai_mask.npy"
    _atomic_save_array(mask_path, mask.astype(np.uint8))
    geometry_path = workspace / "geometry.json"
    _atomic_write_bytes(geometry_path, json.dumps(geometry, indent=2).encode("utf-8"))
    try:
        mesh_urls = request_json(api_base, "/studies/{}/mesh".format(study_id), token)
    except Exception:
        mesh_urls = {"note": "Mesh status unavailable."}
    mesh_path = workspace / "mesh_urls.json"
    _atomic_write_bytes(mesh_path, json.dumps(mesh_urls, indent=2).encode("utf-8"))

    manifest = {
        "study_id": study_id,
        "api_base": normalize_api_base(api_base),
        "workspace_version": 1,
        "imaging_source": imaging_source,
        "dicom_dir": str(dicom_dir),
        "nifti_path": str(nifti_path) if nifti_path else None,
        "imaging_note": imaging_note.strip(),
        "geometry_path": str(geometry_path),
        "geometry": geometry,
        "mask_path": str(mask_path),
        "mesh_urls_path": str(mesh_path),
        "mesh_urls": mesh_urls,
        "labels": dict(LABELS),
        "orientation": "zyx",
        "shape_zyx": list(shape),
        "spacing_zyx_mm": list(spacing),
    }
    manifest_path = workspace / "slicer_import_manifest.json"
    write_manifest(manifest_path, manifest)
    manifest["manifest_path"] = str(manifest_path)
    return manifest


def load_workspace_manifest(workspace: Path) -> Dict[str, Any]:
    path = Path(workspace).expanduser().resolve() / "slicer_import_manifest.json"
    if not path.is_file():
        raise FileNotFoundError("Workspace manifest not found: {}".format(path))
    manifest = json.loads(path.read_text(encoding="utf-8"))
    assert_no_secrets(manifest)
    geometry_from_manifest(manifest)
    manifest["manifest_path"] = str(path)
    return manifest


def validate_allowed_labels(mask: np.ndarray) -> Tuple[int, ...]:
    if not isinstance(mask, np.ndarray) or mask.ndim != 3:
        raise ValueError("Mask must be a 3D numpy array in [Z,Y,X] order.")
    values = tuple(int(value) for value in np.unique(mask))
    unexpected = sorted(set(values) - ALLOWED_LABELS)
    if unexpected:
        raise ValueError(
            "Mask contains unsupported labels {}; allowed labels are 0, 1, 2.".format(
                unexpected
            )
        )
    return values


def validate_geometry(
    mask: np.ndarray,
    expected_shape_zyx: Sequence[int],
    expected_spacing_zyx: Sequence[float],
    actual_spacing_zyx: Sequence[float],
) -> None:
    shape = tuple(int(value) for value in expected_shape_zyx)
    if tuple(mask.shape) != shape:
        raise ValueError(
            "Mask shape {} does not match study geometry {}.".format(mask.shape, shape)
        )
    expected = tuple(float(value) for value in expected_spacing_zyx)
    actual = tuple(float(value) for value in actual_spacing_zyx)
    if len(expected) != 3 or len(actual) != 3:
        raise ValueError("Spacing must contain exactly three values in [Z,Y,X] order.")
    if any(
        not math.isfinite(value) or value <= 0 or value > 1000
        for value in expected + actual
    ):
        raise ValueError("Spacing values must be finite and in (0, 1000] mm.")
    if any(
        abs(requested - observed) > SPACING_TOLERANCE_MM
        for requested, observed in zip(expected, actual)
    ):
        raise ValueError(
            "Volume spacing {} does not match study geometry {}.".format(actual, expected)
        )


def build_revision_payload(
    mask: np.ndarray, spacing_zyx: Sequence[float], note: str
) -> Dict[str, Any]:
    validate_allowed_labels(mask)
    return {
        "source": "slicer",
        "revision_note": note.strip() or "Slicer module edit",
        "geometry": {
            "shape_zyx": [int(value) for value in mask.shape],
            "spacing_zyx_mm": [float(value) for value in spacing_zyx],
            "orientation": "zyx",
        },
        "labels": dict(LABELS),
        "mask_b64": base64.b64encode(mask.astype(np.uint8).tobytes()).decode("ascii"),
    }


def push_revision(
    api_base: str,
    study_id: str,
    token: str,
    mask: np.ndarray,
    spacing_zyx: Sequence[float],
    note: str,
) -> Dict[str, Any]:
    if not token.strip():
        raise ValueError("A bearer token or login is required.")
    study_id = validate_study_id(study_id)
    payload = build_revision_payload(mask, spacing_zyx, note)
    integration_token = issue_slicer_token(api_base, study_id, token)
    return request_json(
        api_base,
        "/studies/{}/segmentation-revisions".format(study_id),
        integration_token,
        payload,
    )


def get_sync_status(api_base: str, study_id: str, token: str) -> Dict[str, Any]:
    if not token.strip():
        raise ValueError("A bearer token or login is required.")
    return request_json(
        api_base,
        "/studies/{}/segmentation-sync/status".format(study_id.strip()),
        token,
    )
