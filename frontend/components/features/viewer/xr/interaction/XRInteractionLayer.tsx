import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { findGrabbableHit } from "./xr-grab";
import { makeXrLaser } from "./xr-laser";

export function XRInteractionLayer() {
  const { gl, scene, camera } = useThree();

  const raycasterRef = useRef(new THREE.Raycaster());
  const grabbedRef = useRef<THREE.Object3D | null>(null);
  const grabControllerRef = useRef<THREE.Object3D | null>(null);
  const grabOffsetRef = useRef(new THREE.Matrix4());
  const lockedRotationRef = useRef(new THREE.Quaternion());
  const lockedScaleRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const renderer = gl;
    const controller1 = renderer.xr.getController(0);
    const controller2 = renderer.xr.getController(1);

    makeXrLaser(controller1);
    makeXrLaser(controller2);

    scene.add(controller1);
    scene.add(controller2);

    const onSelectStart = (event: { target: THREE.Object3D }) => {
      if (grabbedRef.current) return;
      const ctrl = event.target;
      const hit = findGrabbableHit(ctrl, scene, camera, raycasterRef.current);
      if (!hit) return;

      grabbedRef.current = hit;
      grabControllerRef.current = ctrl;
      lockedRotationRef.current.copy(hit.quaternion);
      lockedScaleRef.current.copy(hit.scale);

      const inv = new THREE.Matrix4().copy(ctrl.matrixWorld).invert();
      grabOffsetRef.current.copy(inv.multiply(hit.matrixWorld));
    };

    const onSelectEnd = (event: { target: THREE.Object3D }) => {
      if (event.target !== grabControllerRef.current) return;
      grabbedRef.current = null;
      grabControllerRef.current = null;
    };

    controller1.addEventListener("selectstart", onSelectStart);
    controller1.addEventListener("selectend", onSelectEnd);
    controller2.addEventListener("selectstart", onSelectStart);
    controller2.addEventListener("selectend", onSelectEnd);

    return () => {
      controller1.removeEventListener("selectstart", onSelectStart);
      controller1.removeEventListener("selectend", onSelectEnd);
      controller2.removeEventListener("selectstart", onSelectStart);
      controller2.removeEventListener("selectend", onSelectEnd);
      scene.remove(controller1);
      scene.remove(controller2);
    };
  }, [gl, scene, camera]);

  useFrame(() => {
    const grabbed = grabbedRef.current;
    const grabController = grabControllerRef.current;
    if (!grabbed || !grabController) return;

    const m = new THREE.Matrix4()
      .copy(grabController.matrixWorld)
      .multiply(grabOffsetRef.current);

    const nextPos = new THREE.Vector3();
    m.decompose(nextPos, new THREE.Quaternion(), new THREE.Vector3());
    grabbed.position.copy(nextPos);
    grabbed.quaternion.copy(lockedRotationRef.current);
    grabbed.scale.copy(lockedScaleRef.current);
  });

  return null;
}
