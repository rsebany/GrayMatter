# 3D Slicer Integration

GrayMatter supports a **full round-trip** with [3D Slicer](https://www.slicer.org/): pull study imaging + AI mask from the API, edit hippocampus labels in Slicer, push revisions back, and refresh GLB/STL meshes in the web app.

## Prerequisites

- GrayMatter stack running (Docker or local backend)
- 3D Slicer 5.x
- A completed study (`study_id` like `ST-abc12345`) with segmentation
- Normal authenticated session token (`BEARER_TOKEN`)

### Get a session token

```powershell
# Login (Docker via nginx) — local SEED_* credentials from .env.example only
curl -X POST http://localhost/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"researcher@graymatter.local\",\"password\":\"researcher12345\"}"

$env:BEARER_TOKEN = "<access_token from response>"
```

The Slicer module and `slicer_connect.py` use this token for read operations.
Immediately before a revision push they exchange it through
`POST /auth/slicer-token` for a short-lived token restricted to
`segmentation:write` on that one study. The scoped token is held only for the
request and is never written to the workspace. A normal session token cannot
write the Slicer revision endpoint, and a Slicer token cannot be used for web
rollback or other authenticated API operations.

For remote Slicer on another PC, use the LAN API URL from `GET /api/health` → `slicer.api_base`.

### Install the GrayMatter module

1. Enable **Edit > Application Settings > Developer > Developer mode**.
2. Add this directory under **Application Settings > Modules > Additional
   module paths**:

   ```text
   <GrayMatter>\backend\scripts\integrations\GrayMatterSlicer\GrayMatterSlicer
   ```

3. Restart Slicer and open **Modules > Informatics > GrayMatter**.
4. Use a separate base workspace such as
   `C:\Users\<you>\Desktop\GrayMatterSlicerData`; do not use the module source
   directory or append the study ID.

Select **Remember me** before login to store the normal one-week session token
in Windows Credential Manager. The password and short-lived write tokens are
never stored. Use **Forget saved login** to remove the saved session.

## Label semantics

| Value | Structure |
|-------|-----------|
| 0 | Background |
| 1 | Left hippocampus |
| 2 | Right hippocampus |

Masks are **uint8**, index order **\[Z, Y, X\]**, matching the study volume on the server.

## 1. Pull study into a workspace

From `backend/`:

```powershell
cd backend
python scripts/integrations/slicer_connect.py `
  --api-base http://localhost/api `
  pull `
  --study-id ST-abc12345 `
  --out-dir ./slicer_workspace/ST-abc12345
```

Creates:

- `dicom/` — extracted DICOM series (if stored on server)
- `volume.nii.gz` (or `.nii`) — NIfTI volume when the study has no DICOM on disk
- `ai_mask.npy` — current AI mask
- `geometry.json` — native shape + spacing
- `mesh_urls.json` — GLB + STL links
- `slicer_import_manifest.json` — import metadata for Slicer

For NIfTI-only studies, `pull` downloads the volume via `GET /studies/{id}/nifti` and records `nifti_path` in the manifest. Geometry and mask still align via `geometry.json`.

## 2. Import in 3D Slicer

### Option A — Python console

Add `backend/scripts` to `sys.path`, then:

```python
import graymatter_slicer_module as gm

manifest = gm.load_manifest(r"G:/Research/GrayMatter/backend/slicer_workspace/ST-xxx/slicer_import_manifest.json")
ref = gm.load_reference_volume(manifest)  # DICOM dir or NIfTI from pull
seg = gm.load_ai_segmentation(manifest["mask_path"], ref, manifest)
```


### Option B — Manual

1. **DICOM module** → Import `dicom/` folder
2. **Segmentations** → Import `ai_mask.npy` as labelmap (match reference volume spacing)

## 3. Edit and export

Edit left/right hippocampus in Segment Editor. Export a uint8 `[Z,Y,X]` numpy array:

```python
mask = gm.export_labelmap_to_numpy(seg)
import numpy as np
np.save(r"G:/path/edited_mask.npy", mask)
```

## 4. Push revision to GrayMatter

```powershell
python scripts/integrations/slicer_connect.py `
  --api-base http://localhost/api `
  push `
  --study-id ST-abc12345 `
  --mask-npy ./edited_mask.npy `
  --spacing 1.2,0.7,0.7
```

Or from Slicer console (stdlib HTTP only):

```python
spacing = tuple(manifest["spacing_zyx_mm"])
gm.push_to_graymatter(
    "http://localhost/api",
    manifest["study_id"],
    mask,
    spacing,
    token="YOUR_JWT",
)
```

### Live watch (file changes)

```powershell
python scripts/integrations/slicer_connect.py watch `
  --study-id ST-abc12345 `
  --mask-npy ./edited_mask.npy `
  --spacing 1.2,0.7,0.7
```

Legacy wrapper (still works):

```powershell
python scripts/integrations/slicer_bridge.py --study-id ST-xxx --mask-npy ./mask.npy --spacing z,y,x
```

## 5. Verify in web app

- Open **View 3D** for the study before pushing. After acceptance, it shows a
  success toast and refreshes the mesh, metrics, sync status, and revision
  history through SSE without reloading.
- WebXR also refreshes the accepted mesh.
- The success toast is live confirmation, not a persistent notification-center
  entry.
- Check sync status:

```powershell
python scripts/integrations/slicer_connect.py status --study-id ST-abc12345
```

## API reference

| Endpoint | Purpose |
|----------|---------|
| `GET /studies/{id}/dicom-zip` | Download DICOM series |
| `GET /studies/{id}/dicom-shape` | Native volume shape + spacing |
| `GET /studies/{id}/nifti` | Download NIfTI volume |
| `GET /studies/{id}/mask` | AI mask bytes (`X-Mask-Shape` header) |
| `GET /studies/{id}/mesh` | GLB + STL URLs |
| `POST /auth/slicer-token` | Issue a short-lived, study-scoped revision-write token |
| `POST /studies/{id}/segmentation-revisions` | Push edited mask (scoped Slicer token required) |
| `GET /studies/{id}/segmentation-sync/status` | Latest revision |
| `GET /studies/{id}/events` | SSE live updates |

See also `GET /api/health` → `slicer` block for CLI hints.

## Production controls

- Serve the API over TLS when Slicer is not on the same trusted host.
- Keep session tokens out of command lines, workspace files, screenshots, and
  logs; prefer the `BEARER_TOKEN` environment variable or the module login UI.
- `GRAYMATTER_SLICER_TOKEN_TTL_MINUTES` controls scoped-token lifetime and is
  clamped to 1–60 minutes (default 15).
- Revision metadata returned to clients omits authenticated user and workstation
  identifiers. Workstation values are stored only as a truncated SHA-256 audit
  fingerprint, and internal failure details are not exposed.
- DICOM ZIP extraction rejects traversal, symlinks, encrypted entries, excessive
  file counts, and excessive expanded size. This is not a PACS or regulatory
  compliance subsystem.
