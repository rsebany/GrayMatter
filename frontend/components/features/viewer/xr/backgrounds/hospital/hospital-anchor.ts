import * as THREE from "three";

/** World-space anchor for the operative table / workspace inside the GLB. */
export function resolveOrInteriorAnchor(
  root: THREE.Object3D,
  fittedBox: THREE.Box3,
): THREE.Vector3 {
  const opBox = new THREE.Box3();
  let matched = false;
  root.traverse((obj) => {
    if (obj.name === "OP_Mitte" || obj.name?.startsWith("OP_Mitte_")) {
      opBox.expandByObject(obj);
      matched = true;
    }
  });
  if (matched && !opBox.isEmpty()) {
    return opBox.getCenter(new THREE.Vector3());
  }

  const fallback = new THREE.Vector3();
  fittedBox.getCenter(fallback);
  const size = new THREE.Vector3();
  fittedBox.getSize(size);
  fallback.y = fittedBox.min.y + size.y * 0.38;
  return fallback;
}
