# GRAYMATTER

Open platform for left/right hippocampus segmentation. The production checkpoint uses the
**Lightweight Hybrid Attention U-Net** with coordinate and inter-slice attention
(`skip_mode: "full"`).

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

The release tag is historical: its production checkpoint requires
`skip_mode: "full"` as configured in `ai/configs/hybrid_attention_v1.json`.

Open **http://localhost** — login `researcher@graymatter.local` / `researcher12345` (local seed from `.env.example` only).

Check inference weights: http://localhost/api/health should show `weights_exists: true`.

MRI dataset is **not** required to run the app (upload volumes in the UI). For
training / OOF only, see the
[local dataset guide](ai/datasets/templates/dataset_README.md).

Optional scaling and security variables, ports, and logs are documented in
[docs/INSTALL.md](docs/INSTALL.md).

 
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