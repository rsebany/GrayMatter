"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import {
  combineAnchor,
  XR_CLINICAL_ZONE,
  XR_IMMERSIVE_MESH_ROTATION_OFFSET,
  XR_MESH_DEFAULT_VIEW_ROTATION,
  XR_SIDE_BY_SIDE,
} from "@/lib/xr/layout-constants";
import { type SceneEulerRotation, stepRotationY } from "@/lib/xr/scene-rotation";

export function useMeshSceneState({
  isPresenting,
  isArImmersive,
  sceneVariant,
  vrSpawnNonce,
}: {
  isPresenting: boolean;
  isArImmersive: boolean;
  sceneVariant: "vr" | "ar";
  vrSpawnNonce: number;
}) {
  const [meshDragOffset, setMeshDragOffset] = useState<[number, number, number]>([0, 0, 0]);
  const [meshRotation, setMeshRotation] = useState<SceneEulerRotation>(XR_MESH_DEFAULT_VIEW_ROTATION);
  const [arAnchor, setArAnchor] = useState<[number, number, number]>(() => [...XR_CLINICAL_ZONE.center]);

  const clinicalZonePosition = useMemo((): [number, number, number] => {
    if (isArImmersive) return arAnchor;
    return [...XR_CLINICAL_ZONE.center];
  }, [isArImmersive, arAnchor]);

  const meshGroupPosition = useMemo(
    () => combineAnchor(XR_SIDE_BY_SIDE.mesh, meshDragOffset),
    [meshDragOffset],
  );

  const meshDisplayRotation = useMemo((): SceneEulerRotation => {
    if (!isPresenting) return meshRotation;
    const [ox, oy, oz] = XR_IMMERSIVE_MESH_ROTATION_OFFSET;
    return [meshRotation[0] + ox, meshRotation[1] + oy, meshRotation[2] + oz];
  }, [isPresenting, meshRotation]);

  const rotateMeshY = useCallback((direction: 1 | -1) => {
    setMeshRotation((current) => stepRotationY(current, direction));
  }, []);

  const resetMeshRotation = useCallback(() => {
    setMeshRotation(XR_MESH_DEFAULT_VIEW_ROTATION);
  }, []);

  const flipMesh = useCallback(() => {
    setMeshRotation((current) => [current[0] + Math.PI, current[1], current[2]]);
  }, []);

  const resetMeshTransform = useCallback(() => {
    setMeshDragOffset([0, 0, 0]);
    setMeshRotation(XR_MESH_DEFAULT_VIEW_ROTATION);
  }, []);

  useEffect(() => {
    if (!isPresenting || sceneVariant !== "vr") return;
    resetMeshTransform();
  }, [isPresenting, sceneVariant, vrSpawnNonce, resetMeshTransform]);

  const placeArContentInFrontOfUser = useCallback((camera: THREE.Camera) => {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, -1);
    else direction.normalize();
    const target = new THREE.Vector3().copy(camera.position).addScaledVector(direction, 1.15);
    target.y = XR_CLINICAL_ZONE.center[1];
    setArAnchor([target.x, target.y, target.z]);
  }, []);

  return {
    meshDragOffset,
    setMeshDragOffset,
    meshRotation,
    arAnchor,
    setArAnchor,
    clinicalZonePosition,
    meshGroupPosition,
    meshDisplayRotation,
    rotateMeshY,
    resetMeshRotation,
    flipMesh,
    resetMeshTransform,
    placeArContentInFrontOfUser,
  };
}
