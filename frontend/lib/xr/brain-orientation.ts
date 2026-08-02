import * as THREE from "three";

/**
 * Marching-cubes verts are (z, y, x) indices × spacing → stored in GLB as
 * Three.js (x, y, z) = (z_mm, y_mm, x_mm). Map to clinical Y-up:
 *   X = left–right (x_mm), Y = cranio-caudal (z_mm), Z = anterior–posterior (−y_mm).
 */
const BACKEND_MM_TO_THREEJS = new THREE.Matrix4().set(
  0, 0, 1, 0,
  1, 0, 0, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
);

export function orientBrainMeshGeometry(geometry: THREE.BufferGeometry): void {
  geometry.applyMatrix4(BACKEND_MM_TO_THREEJS);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/** Upright brain in View3D / XR: clinical Y-up. */
export function applyBrainAnatomicalOrientation(root: THREE.Object3D): void {
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    const oriented = child.geometry.clone();
    orientBrainMeshGeometry(oriented);
    child.geometry.dispose();
    child.geometry = oriented;
  });

  root.updateMatrixWorld(true);
}
