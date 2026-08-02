import * as THREE from "three";

export function findGrabbableHit(
  controller: THREE.Object3D,
  scene: THREE.Scene,
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
): THREE.Object3D | null {
  const tempMatrix = new THREE.Matrix4().identity().extractRotation(controller.matrixWorld);
  const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
  const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix);

  raycaster.set(origin, direction);
  raycaster.camera = camera;

  const grabbables: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (obj.userData?.grabbable) {
      grabbables.push(obj);
    }
  });

  if (grabbables.length === 0) return null;

  const intersects = raycaster.intersectObjects(grabbables, true);
  if (intersects.length === 0) return null;

  let obj: THREE.Object3D | null = intersects[0].object;
  while (obj && !obj.userData?.grabbable) {
    obj = obj.parent;
  }
  return obj;
}
