# GRAYMATTER

Open platform for hippocampal subregion segmentation. Production default: **Coordinate Attention** (`skip_mode: "coord_only"`).

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue)
![MONAI](https://img.shields.io/badge/MONAI-1.4.0-007bff)

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

Open **http://localhost** — login `researcher@graymatter.local` / `researcher12345` (local seed from `.env.example` only).

Check inference weights: http://localhost/api/health should show `weights_exists: true`.

MRI dataset is **not** required to run the app (upload volumes in the UI). For training / OOF only, see [dataset/README.md](dataset/README.md).

More detail: [docs/INSTALL.md](docs/INSTALL.md).

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
entry.

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
dataset/      # local data only (not in git) — see dataset/README.md
docker/       # nginx
docs/         # INSTALL, SLICER, REPRODUCIBILITY
```

## Documentation

- [docs/INSTALL.md](docs/INSTALL.md) — env, ports, logs
- [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md) — training, OOF, paper pins
- [docs/SLICER.md](docs/SLICER.md) — optional 3D Slicer notes
- [dataset/README.md](dataset/README.md) — local dataset prep (not for demo)

## Credits

**Dataset.** Training and evaluation use the [MONAI](https://monai.io/) Hippocampus dataset (Medical Segmentation Decathlon Task04). Cite MONAI and the Medical Segmentation Decathlon when publishing results that use this data.

**WebXR background.** This work is based on ["Charité University Hospital - Operating Room"](https://sketchfab.com/3d-models/charite-university-hospital-operating-room-9ec46c4d615a4581a235eebfb162f574) by [ChrisRE](https://sketchfab.com/ChrisRE), licensed under [CC-BY-NC-4.0](http://creativecommons.org/licenses/by-nc/4.0/) (credit required; no commercial use of this asset). See [`frontend/public/xr/backgrounds/hospital/license.txt`](frontend/public/xr/backgrounds/hospital/license.txt).

Full third-party notices: [NOTICE](NOTICE).

## License

Software and the production checkpoint in this repository are **Apache License 2.0** — see [LICENSE](LICENSE) and the [v1.0.0-coord-attention](https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention) release.

**Carve-out:** `frontend/public/xr/backgrounds/hospital/` is **CC-BY-NC-4.0** (not Apache). Credit required; no commercial use of that asset. See [NOTICE](NOTICE) and [license.txt](frontend/public/xr/backgrounds/hospital/license.txt).