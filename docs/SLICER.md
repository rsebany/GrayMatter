# 3D Slicer Integration

GrayMatter supports a **full round-trip** with [3D Slicer](https://www.slicer.org/): pull study imaging + AI mask from the API, edit hippocampus labels in Slicer, push revisions back, and refresh GLB/STL meshes in the web app.

## Prerequisites

- GrayMatter stack running (Docker or local backend)
- 3D Slicer 5.x
- A completed study (`study_id` like `ST-abc12345`) with segmentation
- JWT bearer token (`BEARER_TOKEN`)

### Get a JWT

```powershell
# Login (Docker via nginx) — local SEED_* credentials from .env.example only
curl -X POST http://localhost/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"researcher@graymatter.local\",\"password\":\"researcher12345\"}"

$env:BEARER_TOKEN = "<access_token from response>"
```

For remote Slicer on another PC, use the LAN API URL from `GET /api/health` → `slicer.api_base`.

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
python scripts/integrations/slicer_connect.py pull `
  --api-base http://localhost/api `
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
python scripts/integrations/slicer_connect.py push `
  --api-base http://localhost/api `
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

- Open **View 3D** or **WebXR** for the study — mesh should update (SSE `mesh.updated`)
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
| `POST /studies/{id}/segmentation-revisions` | Push edited mask (JWT required) |
| `GET /studies/{id}/segmentation-sync/status` | Latest revision |
| `GET /studies/{id}/events` | SSE live updates |

See also `GET /api/health` → `slicer` block for CLI hints.
