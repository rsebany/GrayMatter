# 3D Slicer Integration

GrayMatter supports a full round-trip with [3D Slicer](https://www.slicer.org/): pull study + AI mask, edit labels in Slicer, push revisions back.

## Prerequisites

- GrayMatter stack running (Docker or local backend)
- 3D Slicer 5.x
- Completed study (`ST-abc12345`) with segmentation
- JWT token (see below)

```powershell
curl -X POST http://localhost/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"researcher@graymatter.local\",\"password\":\"researcher12345\"}"
$env:BEARER_TOKEN = "<access_token>"
```

## Label Map

| Value | Structure |
|-------|-----------|
| 0 | Background |
| 1 | Left hippocampus |
| 2 | Right hippocampus |

Masks: **uint8**, index order `[Z, Y, X]`.

## Workflow

### 1. Pull

```powershell
cd backend
python scripts/integrations/slicer_connect.py pull `
  --api-base http://localhost/api `
  --study-id ST-abc12345 `
  --out-dir ./slicer_workspace/ST-abc12345
```

Outputs: `dicom/` or `volume.nii.gz`, `ai_mask.npy`, `geometry.json`, `slicer_import_manifest.json`.

### 2. Import in Slicer

**Python:**
```python
import graymatter_slicer_module as gm
manifest = gm.load_manifest(r"...\slicer_import_manifest.json")
ref = gm.load_reference_volume(manifest)
seg = gm.load_ai_segmentation(manifest["mask_path"], ref, manifest)
```

**Manual:** DICOM module → import `dicom/`, Segmentations → import `ai_mask.npy`.

### 3. Edit & Export

```python
mask = gm.export_labelmap_to_numpy(seg)
np.save(r"edited_mask.npy", mask)
```

### 4. Push

```powershell
python scripts/integrations/slicer_connect.py push `
  --api-base http://localhost/api `
  --study-id ST-abc12345 `
  --mask-npy ./edited_mask.npy `
  --spacing 1.2,0.7,0.7
```

### 5. Verify

Open **View 3D** or **WebXR**, mesh updates via SSE. Check status:
```powershell
python scripts/integrations/slicer_connect.py status --study-id ST-abc12345
```

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /studies/{id}/dicom-zip` | DICOM series |
| `GET /studies/{id}/nifti` | NIfTI volume |
| `GET /studies/{id}/mask` | AI mask |
| `GET /studies/{id}/mesh` | GLB + STL URLs |
| `POST /studies/{id}/segmentation-revisions` | Push edited mask |
| `GET /studies/{id}/segmentation-sync/status` | Latest revision |
| `GET /studies/{id}/events` | SSE live updates |
