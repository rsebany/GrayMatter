"""Marching-cubes GLB/STL export for hippocampus class meshes and brain shell."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh

from services.ai.constants import CLASS_LABELS

MESH_NODE_NAMES: dict[str, str] = {
    "left": "left",
    "right": "right",
    "brain_shell": "brain_shell",
}
_MESH_PALETTE: dict[str, np.ndarray] = {
    "left": np.array([16, 185, 129, 255], dtype=np.uint8),
    "right": np.array([99, 102, 241, 255], dtype=np.uint8),
    "brain_shell": np.array([148, 163, 184, 255], dtype=np.uint8),
}

__all__ = [
    "MESH_NODE_NAMES",
    "MeshExportResult",
    "generate_mesh_exports",
    "generate_mesh_glb",
]


@dataclass(frozen=True)
class MeshExportResult:
    glb_url: str
    stl_url: str
    glb_path: str
    stl_path: str


def _build_submesh(
    binary_mask: np.ndarray,
    spacing_arr: np.ndarray,
    color: np.ndarray,
) -> trimesh.Trimesh | None:
    from skimage.measure import marching_cubes

    vol = (np.asarray(binary_mask) > 0).astype(np.float32)
    if not np.any(vol):
        return None
    try:
        verts, faces, _, _ = marching_cubes(vol, level=0.5)
    except (ValueError, RuntimeError):
        return None
    if verts.size == 0 or faces.size == 0:
        return None
    mesh = trimesh.Trimesh(vertices=verts * spacing_arr, faces=faces, process=False)
    vertex_colors = np.tile(color, (mesh.vertices.shape[0], 1)).astype(np.uint8)
    return trimesh.Trimesh(
        vertices=mesh.vertices,
        faces=mesh.faces,
        vertex_colors=vertex_colors,
        process=False,
    )


def _brain_mask_from_mri(volume: np.ndarray) -> np.ndarray:
    from scipy import ndimage

    vol = np.asarray(volume, dtype=np.float32)
    finite = vol[np.isfinite(vol)]
    if finite.size == 0:
        return np.zeros(vol.shape, dtype=bool)
    vmin, vmax = float(finite.min()), float(finite.max())
    if vmax <= vmin:
        return np.zeros(vol.shape, dtype=bool)
    norm = (vol - vmin) / (vmax - vmin)
    thresh = float(np.percentile(norm[np.isfinite(norm)], 25.0))
    rough = norm > thresh
    labeled, count = ndimage.label(rough)
    if count == 0:
        return rough
    sizes = ndimage.sum(rough, labeled, index=range(1, count + 1))
    largest = int(np.argmax(sizes)) + 1
    brain = labeled == largest
    brain = ndimage.binary_closing(brain, iterations=2)
    return ndimage.binary_fill_holes(brain)


def _brain_shell_mask(
    mask: np.ndarray,
    volume: np.ndarray | None = None,
) -> np.ndarray:
    """Intracranial envelope from MRI brain mask or segmentation bbox fallback."""
    if volume is not None:
        from scipy import ndimage

        brain = _brain_mask_from_mri(volume)
        if np.any(brain):
            shell = ndimage.binary_erosion(brain, iterations=1)
            fg = mask > 0
            shell = shell & ~fg
            if np.any(shell):
                return shell

    fg = mask > 0
    if not np.any(fg):
        return np.zeros_like(mask, dtype=bool)
    coords = np.argwhere(fg)
    z0, y0, x0 = coords.min(axis=0)
    z1, y1, x1 = coords.max(axis=0)
    pad = 2
    z0, y0, x0 = [max(0, v - pad) for v in (z0, y0, x0)]
    z1, y1, x1 = [min(s - 1, v + pad) for v, s in zip((z1, y1, x1), mask.shape)]
    shell = np.zeros(mask.shape, dtype=bool)
    shell[z0 : z1 + 1, y0 : y1 + 1, x0 : x1 + 1] = True
    return shell & ~fg


def _build_scene(
    mask: np.ndarray,
    spacing_arr: np.ndarray,
    volume: np.ndarray | None,
) -> tuple[trimesh.Scene, list[trimesh.Trimesh]]:
    scene = trimesh.Scene()
    stl_meshes: list[trimesh.Trimesh] = []
    contains_geometry = False

    for label_id, name in CLASS_LABELS.items():
        sub = _build_submesh(mask == label_id, spacing_arr, _MESH_PALETTE[name])
        if sub is None:
            continue
        node = MESH_NODE_NAMES[name]
        scene.add_geometry(sub, geom_name=node, node_name=node)
        stl_meshes.append(sub)
        contains_geometry = True

    shell = _build_submesh(
        _brain_shell_mask(mask, volume),
        spacing_arr,
        _MESH_PALETTE["brain_shell"],
    )
    if shell is not None:
        node = MESH_NODE_NAMES["brain_shell"]
        scene.add_geometry(shell, geom_name=node, node_name=node)
        stl_meshes.append(shell)
        contains_geometry = True

    return scene, stl_meshes if contains_geometry else []


def generate_mesh_exports(
    mask: np.ndarray,
    output_dir: Path,
    spacing: tuple[float, float, float],
    volume: np.ndarray | None = None,
    *,
    output_basename: str | None = None,
) -> MeshExportResult:
    """Export hippocampus meshes as GLB (WebXR) and combined STL."""
    output_dir.mkdir(parents=True, exist_ok=True)
    spacing_arr = np.array(spacing, dtype=np.float64)
    scene, stl_meshes = _build_scene(mask, spacing_arr, volume)

    if not stl_meshes:
        return MeshExportResult(glb_url="", stl_url="", glb_path="", stl_path="")

    base = (output_basename or f"brain_{uuid.uuid4().hex}").strip()
    if base.lower().endswith((".glb", ".stl")):
        base = Path(base).stem

    glb_name = f"{base}.glb"
    stl_name = f"{base}.stl"
    glb_path = output_dir / glb_name
    stl_path = output_dir / stl_name

    scene.export(file_obj=str(glb_path), file_type="glb")

    if len(stl_meshes) == 1:
        stl_meshes[0].export(file_obj=str(stl_path), file_type="stl")
    else:
        combined = trimesh.util.concatenate(stl_meshes)
        combined.export(file_obj=str(stl_path), file_type="stl")

    return MeshExportResult(
        glb_url=f"/static/meshes/{glb_name}",
        stl_url=f"/static/meshes/{stl_name}",
        glb_path=str(glb_path),
        stl_path=str(stl_path),
    )


def generate_mesh_glb(
    mask: np.ndarray,
    output_dir: Path,
    spacing: tuple[float, float, float],
    volume_hu: np.ndarray | None = None,
    lung_mask: np.ndarray | None = None,
    *,
    output_filename: str | None = None,
) -> str:
    """Backward-compatible GLB-only export."""
    del lung_mask
    base = output_filename
    if base and base.lower().endswith(".glb"):
        base = Path(base).stem
    result = generate_mesh_exports(
        mask,
        output_dir,
        spacing,
        volume=volume_hu,
        output_basename=base,
    )
    return result.glb_url
