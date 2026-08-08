# GRAYMATTER

Open platform for left/right hippocampus segmentation. The production checkpoint uses the
**Lightweight Hybrid Attention U-Net** with coordinate and inter-slice attention
(`skip_mode: "full"`).

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue)
![MONAI](https://img.shields.io/badge/MONAI-1.4.0-007bff)

## Features

- DICOM and NIfTI MRI upload with MONAI-based attention segmentation.
- Re-analysis from either viewer with a selectable architecture; the production
  Lightweight Hybrid Attention U-Net is always registered, while additional
  models appear only when their local checkpoints are installed.
- Axial, coronal, and sagittal 2D review with left/right hippocampus overlays.
- Interactive 3D reconstruction plus immersive WebXR review.
- Total and left/right segmentation volumes reported in cm³ in the 2D and 3D
  viewers. WebXR uses the practitioner's display-unit preference.
- Optional 3D Slicer correction workflow with immutable revisions and live web updates.

## Quick start

Weights are **not** in git. Download the production checkpoint, then start Docker:

```powershell
# 1) Env
Copy-Item .env.example .env

# 2) Weights → ai/checkpoints/model.pt
#    From https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention
New-Item -ItemType Directory -Force -Path ai/checkpoints | Out-Null
# Download the release .pt/.pth asset, then:
#   Move-Item <downloaded-file> ai/checkpoints/model.pt

# 3) Run
docker compose up --build -d
```

```bash
cp .env.example .env
mkdir -p ai/checkpoints
# Download release asset → ai/checkpoints/model.pt
docker compose up --build -d
```

The release tag is historical: its production checkpoint requires
`skip_mode: "full"` as configured in `ai/configs/hybrid_attention_v1.json`.

Open **http://localhost** — login `researcher@graymatter.local` / `researcher12345` (local seed from `.env.example` only).

Check inference weights: http://localhost/api/health should show `weights_exists: true`.

MRI dataset is **not** required to run the app (upload volumes in the UI). For
training / OOF only, see the
[local dataset guide](ai/datasets/templates/dataset_README.md).

Optional scaling and security variables, ports, and logs are documented in
[docs/INSTALL.md](docs/INSTALL.md).

## Main routes

- `/dashboard` — study worklist and recent results.
- `/upload-dicom` — DICOM or NIfTI upload (`/upload` redirects here).
- `/view2d?studyId=ST-...` — multiplanar slice and overlay review.
- `/view3d?studyId=ST-...` — 3D reconstruction and live Slicer synchronization.
- `/xr`, `/xr/vr`, and `/xr/ar` — WebXR entry points (`/webxr` maps to AR).

## 3D Slicer setup

GrayMatter includes a scripted 3D Slicer 5.x module for reviewing and correcting
AI hippocampus segmentations.

1. In Slicer, enable **Edit → Application Settings → Developer → Developer
   mode**.
2. Under **Application Settings → Modules → Additional module paths**, add:

   ```text
   <GrayMatter>\backend\scripts\integrations\GrayMatterSlicer\GrayMatterSlicer
   ```

3. Restart Slicer and open **Modules → Informatics → GrayMatter**.
4. Enter the API URL (`http://localhost/api`), the `ST-...` study ID, and the
   same account used by the web app.
5. Choose a separate workspace folder, such as
   `C:\Users\<you>\Desktop\GrayMatterSlicerData`. Do not use the module source
   directory and do not append the study ID yourself.
6. Click **Pull and load**, edit the left/right segments in Segment Editor, add
   a revision note, then click **Export and push**.

On a successful push, the backend validates geometry and labels, stores an
immutable revision, updates the active mask, recalculates metrics, regenerates
GLB/STL meshes, and publishes live events. An open View 3D page shows a success
toast and refreshes its mesh, metrics, sync status, and revision history without
a page reload. This is a live confirmation, not a persistent notification-center
entry. Live SSE refresh is limited to an open View 3D page.

On Windows, select **Remember me** before logging in to store the one-week
session token in Windows Credential Manager; the password is never stored.
**Forget saved login** removes it.

Full setup, CLI usage, troubleshooting, and security notes:
[docs/SLICER.md](docs/SLICER.md).

## Layout

```
ai/           # models, training, inference, evaluation, configs, notebooks
backend/      # FastAPI
frontend/     # Next.js + Three.js / WebXR
dataset/      # local data only (not in git) — see the local dataset guide
docker/       # nginx
docs/         # INSTALL, SLICER, REPRODUCIBILITY
```

## Documentation

- [docs/INSTALL.md](docs/INSTALL.md) — env, ports, logs
- [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md) — training, OOF, paper pins
- [docs/SLICER.md](docs/SLICER.md) — optional 3D Slicer notes
- [Local dataset guide](ai/datasets/templates/dataset_README.md) — training data prep (not for demo)

## Credits

**Dataset.** Training and evaluation use the [MONAI](https://monai.io/) Hippocampus dataset (Medical Segmentation Decathlon Task04). Cite MONAI and the Medical Segmentation Decathlon when publishing results that use this data.

**WebXR background.** This work is based on ["Charité University Hospital - Operating Room"](https://sketchfab.com/3d-models/charite-university-hospital-operating-room-9ec46c4d615a4581a235eebfb162f574) by [ChrisRE](https://sketchfab.com/ChrisRE), licensed under [CC-BY-NC-4.0](http://creativecommons.org/licenses/by-nc/4.0/) (credit required; no commercial use of this asset). See [`frontend/public/xr/backgrounds/hospital/license.txt`](frontend/public/xr/backgrounds/hospital/license.txt).

Full third-party notices: [NOTICE](NOTICE).

## License

Software in this repository is **Apache License 2.0** — see [LICENSE](LICENSE).
The separately distributed production checkpoint is also Apache-2.0; see the
[v1.0.0-coord-attention](https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention)
release.

**Carve-out:** `frontend/public/xr/backgrounds/hospital/` is **CC-BY-NC-4.0** (not Apache). Credit required; no commercial use of that asset. See [NOTICE](NOTICE) and [license.txt](frontend/public/xr/backgrounds/hospital/license.txt).