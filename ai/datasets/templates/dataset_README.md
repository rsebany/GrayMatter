# Local training dataset

The MRI dataset is required only for training and out-of-fold evaluation. It is
not required to run GrayMatter or upload studies through the web application.

Use the Medical Segmentation Decathlon Task04 Hippocampus dataset from the
official MONAI Decathlon download. Dataset files contain medical imaging data
and must remain local; they are excluded from git.

## Expected source layout

Place matching NIfTI images and labels under:

```text
dataset/
  raw/
    images/
    labels/
```

Image and label filenames must share the same case identifier. The preparation
scripts validate pairings, dimensions, geometry, and label values before
creating processed copies.

## Prepare the data

From the repository root:

```powershell
python ai/datasets/prepare_dataset.py --clean
python ai/datasets/create_folds.py
```

Use `--symlink` with `prepare_dataset.py` to avoid copying source volumes, or
`--dataset-root <path>` with either command to use a dataset outside the
repository.

Preparation creates:

```text
dataset/
  processed/
    images/
    labels/
    prepared_cases.json
  manifests/
    fold1.json
    ...
    fold5.json
  reports/
```

Fold manifests are deterministic, patient-separated five-fold splits. Training
and evaluation instructions are in
[docs/REPRODUCIBILITY.md](../../../docs/REPRODUCIBILITY.md).
