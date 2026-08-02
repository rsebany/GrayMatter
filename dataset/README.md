# Local Dataset Directory

This directory stores MRI data and generated preparation artifacts for GRAYMATTER.
Everything under `dataset/` is local-only and ignored by Git, except this README.

## Git Policy

| Path | Committed to Git? |
| --- | --- |
| `raw/` | No — local MRI volumes only |
| `processed/` | No — validated volume copies + `prepared_cases.json` |
| `manifests/` | No — generated fold splits |
| `reports/` | No — QA and inspection artifacts |
| `README.md` | Yes — this file |

Note: `.gitignore` excludes everything under `dataset/` except this README
(`dataset/*` + `!dataset/README.md`). Do **not** add negating rules for
`manifests/`, `processed/`, or `raw/` — those must stay off GitHub.

## Manual Download Required

GRAYMATTER does not download datasets automatically. Obtain the MONAI
Hippocampus dataset and place the volumes directly under `dataset/raw/`:

```text
dataset/raw/images/   # input MRI volumes
dataset/raw/labels/   # segmentation label volumes
```

Images and labels are paired by matching filename stem, so a pair must share the
same name in both folders (e.g. `hippocampus_001.nii.gz`). Supported formats:
`.nii.gz`, `.nii`, `.mha`, `.mhd`, `.nrrd`.

## Setup Workflow

Run from the repository root, in order:

1. **Prepare validated copies**
   ```bash
   python ai/datasets/prepare_dataset.py --clean
   ```
   Validates every raw image/label pair (loadable, 3D, non-empty label, no
   NaN/negative labels) and copies valid pairs into `dataset/processed/`. Writes
   `processed/prepared_cases.json` (valid case manifest) and
   `reports/processing_report.json`. `--clean` removes `processed/` first;
   `--symlink` links files instead of copying.

2. **Create fold manifests**
   ```bash
   python ai/datasets/create_folds.py
   ```
   Reads `processed/prepared_cases.json` and writes deterministic, patient-wise
   cross-validation splits to `manifests/fold{N}.json`, plus
   `reports/fold_statistics.csv`. Optional: `--folds N` (default 5), `--seed S`.

## Expected Layout After Organization

```text
dataset/
├── raw/
│   ├── images/           # downloaded volumes (input)
│   ├── labels/           # downloaded labels (input)
│   └── test_images/      # downloaded test volumes (not consumed by the pipeline)
├── processed/
│   ├── images/           # validated copies or symlinks
│   ├── labels/
│   └── prepared_cases.json
├── manifests/
│   └── fold1.json ... foldN.json
└── reports/
    ├── processing_report.json
    └── fold_statistics.csv
```
