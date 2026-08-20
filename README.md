<div align="center">

# GRAYMATTER

**Deep learning platform for hippocampal subregion segmentation**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue)
![MONAI 1.4.0](https://img.shields.io/badge/MONAI-1.4.0-007bff)
![PyTorch](https://img.shields.io/badge/PyTorch-%3E%3D2.5.0-ee4c2c)

</div>

---

GrayMatter is an open-source platform for automated segmentation of hippocampal subregions (left/right) from 3D MRI volumes. It combines a 3D U-Net with **Coordinate Inter-Slice Attention (CISA)**, a novel skip-connection module that uses triaxial coordinate gating to suppress noisy encoder features before fusion with the decoder.

The platform ships as a full-stack application: a PyTorch inference backend, a FastAPI server, and a Next.js + WebXR viewer for 3D visualization.

## Results

| Variant | CV DSC | OOF DSC | Role |
|---------|--------|---------|------|
| **Coordinate Attention** | 0.8605 | 0.8605 | **Production default**, best generalizer |
| Full CISA | 0.8616 | 0.8457 | Best cross-validation, worst OOF gap |
| Plain U-Net | — | 0.8552 | Identity skip baseline |

Production checkpoint: fold 4, `skip_mode: "coord_only"`, ~15M parameters.

## Quick Start

**Prerequisites:** Windows 10/11 + WSL2, Docker Desktop, Git.

```bash
# 1. Clone
git clone https://github.com/rsebany/GrayMatter.git
cd GrayMatter/GrayMatter

# 2. Environment
cp .env.example .env

# 3. Download weights → ai/checkpoints/model.pt
#    https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention
mkdir -p ai/checkpoints
# Move the downloaded asset to ai/checkpoints/model.pt

# 4. Launch
docker compose up --build -d
```

Open **http://localhost**, login with `researcher@graymatter.local` / `researcher12345`.

Verify weights loaded: `GET /api/health` should return `"weights_exists": true`.

MRI dataset is **not** required to run the app; upload volumes directly in the UI.

## Architecture

A 4-level 3D U-Net with channel widths `[32, 64, 128, 256]`, GroupNorm, Dropout3D (`p=0.1`) at the bottleneck, and a hybrid Dice + cross-entropy loss.

The key contribution is the **skip-connection module**, tested in three variants:

| `skip_mode` | Description | Config |
|-------------|-------------|--------|
| `"identity"` | Plain skip connections (baseline) | `plain_unet_v1.json` |
| `"coord_only"` | Triaxial coordinate gating only | `coord_attention_v1.json` |
| `"full"` | Coordinate gating + depthwise inter-slice convolution | `hybrid_attention_v1.json` |

Coordinate Attention (`"coord_only"`) is the production default; it matches Full CISA on CV Dice with zero CV-to-OOF generalization gap.

## Project Structure

```
GrayMatter/
├── ai/                 # Models, training, inference, evaluation, configs
│   ├── configs/        # Experiment JSON configs
│   ├── models/         # HybridAttentionUNet3D
│   ├── inference/      # Predictor, pipeline, preprocessing
│   ├── training/       # Training loops, dataloaders, losses
│   └── checkpoints/    # Model weights (not in git)
├── backend/            # FastAPI server, routes, services
├── frontend/           # Next.js + Three.js / WebXR viewer
├── docker/             # Nginx config
├── docs/               # Installation, reproducibility, Slicer integration
└── dataset/            # Local data only (not in git)
```

## Documentation

| Doc | Description |
|-----|-------------|
| [INSTALL.md](docs/INSTALL.md) | Environment setup, ports, Docker commands |
| [REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md) | Training pins, OOF evaluation, dataset source |
| [SLICER.md](docs/SLICER.md) | 3D Slicer round-trip integration |
| [dataset/README.md](dataset/README.md) | Local dataset preparation (training only) |

## Dataset

Training and evaluation use the [MONAI](https://monai.io/) Hippocampus dataset (Medical Segmentation Decathlon Task04, `n=260` labeled cases). Volumes are not tracked in git; see [dataset/README.md](dataset/README.md) for preparation steps.

## Credits

- **Dataset:** [MONAI](https://monai.io/) Hippocampus, Medical Segmentation Decathlon Task04. Cite MONAI and the MSD when publishing results using this data.
- **WebXR background:** Based on ["Charite University Hospital - Operating Room"](https://sketchfab.com/3d-models/charite-university-hospital-operating-room-9ec46c4d615a4581a235eebfb162f574) by [ChrisRE](https://sketchfab.com/ChrisRE), licensed [CC-BY-NC-4.0](http://creativecommons.org/licenses/by-nc/4.0/). See [`frontend/public/xr/backgrounds/hospital/license.txt`](frontend/public/xr/backgrounds/hospital/license.txt).

Full third-party notices: [NOTICE](NOTICE).

## License

Apache License 2.0, see [LICENSE](LICENSE) and the [v1.0.0-coord-attention](https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention) release.

**Carve-out:** `frontend/public/xr/backgrounds/hospital/` is CC-BY-NC-4.0 (not Apache). Credit required; no commercial use of that asset.
