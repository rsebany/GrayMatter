import numpy as np
import nibabel as nib
from scipy import ndimage


def clean_mask(mask: np.ndarray) -> np.ndarray:
    cleaned = mask.copy()
    for label in (1, 2):
        component = cleaned == label
        if not component.any():
            continue
        labeled, num = ndimage.label(component)
        if num <= 1:
            continue
        sizes = ndimage.sum(component, labeled, range(1, num + 1))
        largest = int(np.argmax(sizes)) + 1
        cleaned[labeled != largest] = 0
    return cleaned


def voxel_volume_mm3_from_affine(affine: np.ndarray) -> float:
    zooms = nib.affines.voxel_sizes(affine)
    return float(np.prod(zooms))


def compute_volume_mm3(mask: np.ndarray, voxel_volume_mm3: float = 1.0) -> float:
    foreground = mask > 0
    return float(foreground.sum() * voxel_volume_mm3)


def compute_volume_mm3_from_affine(mask: np.ndarray, affine: np.ndarray) -> float:
    return compute_volume_mm3(mask, voxel_volume_mm3_from_affine(affine))
