from io import BytesIO

import numpy as np
import trimesh
from skimage import measure


def mask_to_glb(mask: np.ndarray) -> bytes:
    foreground = (mask > 0).astype(np.float32)
    if foreground.max() == 0:
        mesh = trimesh.creation.icosphere(radius=1.0)
    else:
        try:
            verts, faces, _, _ = measure.marching_cubes(foreground, level=0.5)
            mesh = trimesh.Trimesh(vertices=verts, faces=faces)
            mesh = mesh.simplify_quadric_decimation(face_count=min(50000, len(mesh.faces)))
        except (ValueError, RuntimeError):
            mesh = trimesh.creation.icosphere(radius=1.0)

    buffer = BytesIO()
    mesh.export(buffer, file_type="glb")
    return buffer.getvalue()
