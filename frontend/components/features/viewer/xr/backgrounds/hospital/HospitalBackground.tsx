"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { XR_CLINICAL_ZONE } from "@/components/xr/xr-layout";
import {
  HOSPITAL_RESOURCE_PATH,
  HOSPITAL_SCENE_URL,
  TARGET_FOOTPRINT_METERS,
} from "./hospital.constants";
import { resolveOrInteriorAnchor } from "./hospital-anchor";
import { sanitizeHospitalMaterials } from "./hospital-materials";

export function HospitalBackground() {
  const { scene } = useGLTF(HOSPITAL_SCENE_URL, false, false, (loader) => {
    (loader as unknown as GLTFLoader).setResourcePath(HOSPITAL_RESOURCE_PATH);
  });
  const { preparedScene, position, scale } = useMemo(() => {
    const clone = scene.clone(true);
    sanitizeHospitalMaterials(clone);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const footprint = Math.max(size.x, size.z, 1e-3);
    const fittedScale = TARGET_FOOTPRINT_METERS / footprint;
    const floorY = box.min.y * fittedScale;
    const basePosition = new THREE.Vector3(
      -center.x * fittedScale,
      -floorY,
      -center.z * fittedScale,
    );

    clone.scale.setScalar(fittedScale);
    clone.position.copy(basePosition);
    clone.updateMatrixWorld(true);

    const fittedBox = new THREE.Box3().setFromObject(clone);
    const roomAnchor = resolveOrInteriorAnchor(clone, fittedBox);
    const [tx, ty, tz] = XR_CLINICAL_ZONE.center;

    clone.scale.setScalar(1);
    clone.position.set(0, 0, 0);

    return {
      preparedScene: clone,
      scale: fittedScale,
      position: [
        basePosition.x + (tx - roomAnchor.x),
        basePosition.y + (ty - roomAnchor.y),
        basePosition.z + (tz - roomAnchor.z),
      ] as [number, number, number],
    };
  }, [scene]);

  return (
    <group position={position} scale={scale}>
      <primitive object={preparedScene} />
    </group>
  );
}

useGLTF.preload(HOSPITAL_SCENE_URL);
