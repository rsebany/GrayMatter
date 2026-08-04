# Reproducibility

Pins and commands for reproducing training, OOF evaluation, and the Docker platform.
(SoftwareX / system-paper cite this file for reproducibility pins.)

| Pin | Value |
|-----|--------|
| Python | 3.11+ |
| MONAI | `1.4.0` |
| PyTorch | `>=2.5.0` |
| Config | `ai/configs/hybrid_attention_v1.json` (`skip_mode: "coord_only"`) |
| Checkpoint | `ai/checkpoints/model.pt` (fold 4) |
| Architecture id | `lightweight_attunet` (registry key for production Coordinate Attention) |
| Release | [`v1.0.0-coord-attention`](https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention) (Apache-2.0) — pending: upload the coord-attention checkpoint there (the old `v1.0.0-lightweight-attunet` asset is Full CISA and does **not** match the current default) |
| Dataset | MSD Task04 Hippocampus via official MONAI Decathlon download (canonical); Kaggle optional mirror only |
| Matched variants | `plain_unet` \| `coord_attention` \| `full_cisa` |

To **run the web app**, use [README.md](../README.md) / [INSTALL.md](INSTALL.md) (weights + Docker). This page is for training and evaluation reproducibility.

## Platform

```powershell
Copy-Item .env.example .env
docker compose up --build -d
curl http://localhost/api/health
```

## Train

Three matched variants (shared preprocessing/recipe; deploy default is Coordinate Attention only):

```powershell
python ai/training/train.py --variant plain_unet --folds 1,2,3,4,5
python ai/training/train.py --variant coord_attention --folds 1,2,3,4,5
python ai/training/train.py --variant full_cisa --folds 1,2,3,4,5
```

## OOF

```powershell
cd ai
python -m evaluation.oof_eval `
  --config configs/hybrid_attention_v1.json `
  --results-dir <fold_results> `
  --output-dir <oof_out>
```

Coordinate Attention is the production default: it matches Full CISA on selection-time CV DSC (`0.8605` vs. `0.8616`) with zero CV–OOF gap.
Pooled OOF DSC: coordinate-attention-only `0.8605`, plain U-Net `0.8552`, Full CISA `0.8457`.

## Dataset

**Canonical source:** Medical Segmentation Decathlon Task04 Hippocampus via the official [MONAI](https://monai.io/) Decathlon download (`n=260` labeled training cases used in the system paper). Volumes are not tracked in git.

**Optional Kaggle mirror:** attach **graymatter-dataset-monai** (`images/`, `labels/`, `manifests/`, `prepared_cases.json`) for notebook workflows. Kaggle is a convenience copy only, not the evaluation source of truth.

**Local prep:**

```powershell
# place MSD/MONAI Task04 source under dataset/raw/, then:
python ai/datasets/prepare_dataset.py --clean
python ai/datasets/create_folds.py
```

Layout after prep: `dataset/raw/`, `dataset/processed/images|labels/`, `dataset/manifests/foldN.json` (subject-level 5-fold splits). See [dataset/README.md](../dataset/README.md).

Install notes: [INSTALL.md](INSTALL.md).
