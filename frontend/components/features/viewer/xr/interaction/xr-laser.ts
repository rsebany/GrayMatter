import * as THREE from "three";

export function makeXrLaser(controller: THREE.Object3D) {
  const existing = controller.getObjectByName("xr-laser");
  if (existing) return;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const material = new THREE.LineBasicMaterial({ color: 0xffffff });
  const line = new THREE.Line(geometry, material);
  line.name = "xr-laser";
  line.scale.z = 2;
  controller.add(line);
}
