"""
GrayMatter helpers for 3D Slicer Python console.

Copy this file path into Slicer or add ``backend/scripts`` to ``sys.path``, then:

    import json
    from pathlib import Path
    import graymatter_slicer_module as gm

    manifest = gm.load_manifest(r"C:/path/slicer_workspace/ST-xxx/slicer_import_manifest.json")
    ref_node = gm.load_dicom_series(manifest["dicom_dir"])
    gm.load_ai_segmentation(manifest["mask_path"], ref_node, manifest)

After editing in Segment Editor, export and push:

    mask = gm.export_labelmap_to_numpy(segmentation_node)
    gm.push_to_graymatter(api_base, study_id, mask, spacing_zyx, token=token)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from common.api_client import ApiClient
from common.segmentation_sync import parse_spacing_zyx
from integrations.slicer_connect import push_mask_revision

__all__ = [
    "export_labelmap_to_numpy",
    "load_ai_segmentation",
    "load_dicom_series",
    "load_manifest",
    "load_nifti_volume",
    "load_reference_volume",
    "push_to_graymatter",
]


def load_manifest(manifest_path: str | Path) -> dict[str, Any]:
    path = Path(manifest_path).resolve()
    return json.loads(path.read_text(encoding="utf-8"))


def load_dicom_series(dicom_dir: str | Path):
    """Import DICOM series under ``dicom_dir``; returns first volume node."""
    try:
        import slicer  # type: ignore
    except ImportError as exc:
        raise RuntimeError("This module must run inside 3D Slicer Python.") from exc

    root = Path(dicom_dir).resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"DICOM directory not found: {root}")

    dcm_files = sorted(root.rglob("*.dcm")) + sorted(root.rglob("*.DCM"))
    if not dcm_files:
        raise FileNotFoundError(f"No .dcm files under {root}")

    imported = slicer.util.loadVolume(str(dcm_files[0]))
    if imported is None:
        # Fallback: load via DICOM database
        from DICOMLib import DICOMUtils  # type: ignore

        DICOMUtils.importDicom(str(root))
        patient_ids = slicer.dicomDatabase.patients()
        if not patient_ids:
            raise RuntimeError("DICOM import produced no patients in database.")
        studies = slicer.dicomDatabase.studiesForPatient(patient_ids[0])
        series = slicer.dicomDatabase.seriesForStudy(studies[0])
        imported = slicer.util.loadVolume(slicer.dicomDatabase.fileForInstance(series[0]))

    if imported is None:
        raise RuntimeError("Failed to load DICOM volume in Slicer.")
    return imported


def load_nifti_volume(nifti_path: str | Path):
    """Load a NIfTI file as a volume node."""
    try:
        import slicer  # type: ignore
    except ImportError as exc:
        raise RuntimeError("This module must run inside 3D Slicer Python.") from exc

    path = Path(nifti_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"NIfTI file not found: {path}")

    imported = slicer.util.loadVolume(str(path))
    if imported is None:
        raise RuntimeError(f"Failed to load NIfTI volume: {path}")
    return imported


def load_reference_volume(manifest: dict[str, Any]):
    """Load DICOM or NIfTI reference volume from a pull manifest."""
    source = manifest.get("imaging_source")
    if source == "nifti":
        nifti_path = manifest.get("nifti_path")
        if not nifti_path:
            raise FileNotFoundError("Manifest has imaging_source=nifti but no nifti_path.")
        return load_nifti_volume(nifti_path)
    return load_dicom_series(manifest["dicom_dir"])


def load_ai_segmentation(
    mask_npy: str | Path,
    reference_volume_node,
    manifest: dict[str, Any] | None = None,
):
    """Create a labelmap segmentation node from ``ai_mask.npy`` aligned to ``reference_volume_node``."""
    try:
        import slicer  # type: ignore
    except ImportError as exc:
        raise RuntimeError("This module must run inside 3D Slicer Python.") from exc

    mask = np.load(mask_npy).astype(np.uint8)
    if mask.ndim != 3:
        raise ValueError("Mask must be 3D [Z,Y,X]")

    segmentation_node = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLSegmentationNode")
    segmentation_node.SetReferenceImageGeometryParameterFromVolumeNode(reference_volume_node)

    segments = slicer.vtkSegmentationConverter.GetSegmentationBinaryLabelmapSupportedRepresentations(
        segmentation_node.GetSegmentation()
    )
    if not segments:
        segmentation_node.GetSegmentation().SetMasterRepresentationName(
            slicer.vtkSegmentationConverter.GetSegmentationBinaryLabelmapRepresentationName()
        )

    for label_id, name in ((1, "left"), (2, "right")):
        if not np.any(mask == label_id):
            continue
        segment_id = segmentation_node.GetSegmentation().AddEmptySegment(name)
        slicer.util.updateSegmentFromLabelmapVolumeNode(
            segmentation_node,
            segment_id,
            _labelmap_from_array(mask == label_id, reference_volume_node),
        )

    if manifest:
        segmentation_node.SetName(f"GrayMatter-{manifest.get('study_id', 'study')}")
    return segmentation_node


def _labelmap_from_array(binary_mask: np.ndarray, reference_volume_node):
    import slicer  # type: ignore

    labelmap_node = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLLabelMapVolumeNode")
    labelmap_node.SetSpacing(reference_volume_node.GetSpacing())
    labelmap_node.SetOrigin(reference_volume_node.GetOrigin())
    if hasattr(labelmap_node, "SetImageOrientation"):
        labelmap_node.SetImageOrientation(reference_volume_node.GetImageOrientation())

    import vtk.util.numpy_support as vtk_numpy  # type: ignore
    from vtk import vtkImageData  # type: ignore

    vtk_arr = vtk_numpy.numpy_to_vtk(
        binary_mask.astype(np.uint8).ravel(order="F"),
        deep=True,
        array_type=vtk_numpy.VTK_UNSIGNED_CHAR,
    )
    image = vtkImageData()
    dims = binary_mask.shape
    image.SetDimensions(dims[2], dims[1], dims[0])
    image.SetSpacing(reference_volume_node.GetSpacing())
    image.SetOrigin(reference_volume_node.GetOrigin())
    image.GetPointData().SetScalars(vtk_arr)
    labelmap_node.SetAndObserveImageData(image)
    return labelmap_node


def export_labelmap_to_numpy(segmentation_node) -> np.ndarray:
    """Export combined segmentation labels to uint8 [Z,Y,X] (1=left, 2=right)."""
    try:
        import slicer  # type: ignore
    except ImportError as exc:
        raise RuntimeError("This module must run inside 3D Slicer Python.") from exc

    reference = segmentation_node.GetNodeReference(
        slicer.vtkMRMLSegmentationNode.GetReferenceImageGeometryReferenceRole()
    )
    if reference is None:
        raise RuntimeError("Segmentation has no reference geometry.")

    shape = (
        reference.GetImageData().GetDimensions()[2],
        reference.GetImageData().GetDimensions()[1],
        reference.GetImageData().GetDimensions()[0],
    )
    out = np.zeros(shape, dtype=np.uint8)
    segmentation = segmentation_node.GetSegmentation()
    for idx in range(segmentation.GetNumberOfSegments()):
        segment = segmentation.GetNthSegment(idx)
        name = segment.GetName().lower()
        label = 1 if "left" in name else 2 if "right" in name else idx + 1
        if label > 2:
            continue
        labelmap = slicer.vtkOrientedImageData()
        segmentation_node.GetBinaryLabelmapRepresentation(segment.GetName(), labelmap)
        arr = slicer.util.arrayFromSegmentBinaryLabelmap(
            segmentation_node,
            segment.GetName(),
            reference,
        )
        if arr is not None:
            out[arr > 0] = label
    return out


def push_to_graymatter(
    api_base: str,
    study_id: str,
    mask: np.ndarray,
    spacing_zyx: tuple[float, float, float] | str,
    *,
    token: str,
    note: str = "slicer console push",
) -> dict[str, Any]:
    """Push edited mask to GrayMatter (stdlib HTTP — no requests required)."""
    if isinstance(spacing_zyx, str):
        spacing_zyx = parse_spacing_zyx(spacing_zyx)
    client = ApiClient(api_base, token=token, use_urllib=True, timeout_s=180)
    return push_mask_revision(
        client,
        study_id,
        mask.astype(np.uint8),
        spacing_zyx,
        note=note,
        source="slicer",
    )
