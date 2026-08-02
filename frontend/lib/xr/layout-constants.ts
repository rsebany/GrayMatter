import type { SceneEulerRotation } from "@/lib/xr/scene-rotation";

/** Yaw par défaut du mesh face à la caméra XR (tourne vers la droite / vue antérieure). */
export const XR_MESH_DEFAULT_VIEW_ROTATION: SceneEulerRotation = [0, -Math.PI / 2, 0];

/** Extra rotation in immersive VR/AR: flip the mesh apex downward for table/supine headset view. */
export const XR_IMMERSIVE_MESH_ROTATION_OFFSET: SceneEulerRotation = [Math.PI, 0, 0];

/**
 * Clinical viewing zone inside the hospital OR (floor y≈0 after GLB fit).
 * Anchored to the OP table volume — HospitalBackground aligns the GLB to this point.
 */
export const XR_CLINICAL_ZONE = {
  center: [0, 1.95, -1.35] as [number, number, number],
  /** Rig Z: stand toward +Z from zone center (~2.1 m viewing distance). */
  viewerSpawnZ: 0.55,
} as const;

/** Where the VR rig spawns so mesh + DICOM are in front at session start. */
export const XR_VR_SPAWN = {
  originX: 0,
  originY: 0,
  originZ: XR_CLINICAL_ZONE.viewerSpawnZ,
} as const;

/** Shared XR layout: mesh centered, DICOM parked on the left (offsets from clinical zone). */
export const XR_SIDE_BY_SIDE = {
  dicom: [-1.38, 0, 0] as [number, number, number],
  /** Mesh offset to the right of the DICOM slice, lowered toward eye/table level. */
  mesh: [0.42, -0.12, 0] as [number, number, number],
  defaultMeshScale: 1.26,
} as const;

export function combineAnchor(
  anchor: [number, number, number],
  offset: [number, number, number],
): [number, number, number] {
  return [anchor[0] + offset[0], anchor[1] + offset[1], anchor[2] + offset[2]];
}

export type XrClinicalPart = "mesh" | "dicom";

/** World position for mesh or DICOM (optionally relative to an AR anchor). */
export function clinicalWorldPosition(
  part: XrClinicalPart,
  arAnchor?: [number, number, number],
): [number, number, number] {
  const anchor = arAnchor ?? XR_CLINICAL_ZONE.center;
  return combineAnchor(anchor, XR_SIDE_BY_SIDE[part]);
}

/** Desktop / preview camera pose: inside the OR doorway, framing mesh + DICOM in the room. */
export function xrPreviewCameraPose(): {
  position: [number, number, number];
  target: [number, number, number];
} {
  const [cx, cy, cz] = XR_CLINICAL_ZONE.center;
  return {
    position: [cx, cy + 0.22, cz + 2.05],
    target: [cx, cy + 0.08, cz],
  };
}
