# Reproducibility

Pins and commands for reproducing training, OOF evaluation, and the Docker platform.

## Pins

| Pin | Value |
|-----|-------|
| Python | 3.11+ |
| MONAI | `1.4.0` |
| PyTorch | `>=2.5.0` |
| Config | `ai/configs/hybrid_attention_v1.json` (`skip_mode: "coord_only"`) |
| Checkpoint | `ai/checkpoints/model.pt` (fold 4) |
| Architecture | `hybrid_attunet` — Hybrid Attention U-Net (Coordinate Attention) |
| Release | [`v1.0.0-coord-attention`](https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention) |
| Dataset | MSD Task04 Hippocampus via official MONAI Decathlon download |

## Train

Three matched variants (shared preprocessing/recipe; production default is Coordinate Attention):

```powershell
python ai/training/train.py --variant plain_unet --folds 1,2,3,4,5
python ai/training/train.py --variant coord_attention --folds 1,2,3,4,5
python ai/training/train.py --variant full_cisa --folds 1,2,3,4,5
```

## OOF Evaluation

```powershell
cd ai
python -m evaluation.oof_eval `
  --config configs/hybrid_attention_v1.json `
  --results-dir <fold_results> `
  --output-dir <oof_out>
```

Coordinate Attention is the production default: it matches Full CISA on selection-time CV DSC (`0.8605` vs. `0.8616`) with zero CV–OOF gap.
Pooled OOF DSC: Coordinate Attention `0.8605`, Plain U-Net `0.8552`, Full CISA `0.8457`.

## Dataset

**Source:** Medical Segmentation Decathlon Task04 Hippocampus via official [MONAI](https://monai.io/) Decathlon download (`n=260` labeled cases). Volumes are not tracked in git.

**Local prep:**

```powershell
# Place MSD/MONAI Task04 source under dataset/raw/, then:
python ai/datasets/prepare_dataset.py --clean
python ai/datasets/create_folds.py
```

Layout after prep: `dataset/raw/`, `dataset/processed/images|labels/`, `dataset/manifests/foldN.json` (subject-level 5-fold splits).

Install notes: [INSTALL.md](INSTALL.md).
