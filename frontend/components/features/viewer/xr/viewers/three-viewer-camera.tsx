"use client";

import React, { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Drei OrbitControls ref: methods from THREE.OrbitControls
export type OrbitControlsHandle = { target: THREE.Vector3; update: () => void };

/**
 * Frames camera and orbit target to the combined DICOM stack + mesh bounds.
 * Re-runs briefly after load so late GLB / textures are included.
 */
export function FitToSceneGroup({
  groupRef,
  resetKey,
  controlsRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  resetKey: string;
  controlsRef: React.RefObject<OrbitControlsHandle | null>;
}) {
  const { camera, gl } = useThree();
  const frameCount = useRef(0);
  const wasPresentingRef = useRef(false);

  useLayoutEffect(() => {
    frameCount.current = 0;
  }, [resetKey]);

  useFrame(() => {
    if (gl.xr.isPresenting) {
      wasPresentingRef.current = true;
      return;
    }
    if (wasPresentingRef.current) {
      wasPresentingRef.current = false;
      frameCount.current = 0;
    }
    if (frameCount.current >= 50) return;
    frameCount.current += 1;
    if (!groupRef.current) return;
    const box = new THREE.Box3().setFromObject(groupRef.current);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    let dist = maxDim * 20.0;
    if (camera instanceof THREE.PerspectiveCamera) {
      // Fit by FOV/aspect so the mesh reads clearly without clipping.
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const fitHeightDistance = size.y / (2 * Math.tan(fov / 2));
      const fitWidthDistance = size.x / (2 * Math.tan(fov / 2)) / Math.max(camera.aspect, 0.5);
      dist = Math.max(dist, fitHeightDistance, fitWidthDistance) * 1.7;
    }
    // Use a diagonal desktop angle so both lungs read clearly in View3D.
    const eyeDir = new THREE.Vector3(0.46, 0.16, 1).normalize();
    camera.position.copy(center.clone().addScaledVector(eyeDir, dist));
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 44;
      camera.near = Math.max(0.005, dist * 0.005);
      camera.far = Math.max(100, dist * 40);
    }
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    const oc = controlsRef.current;
    if (oc) {
      oc.target.copy(center);
      oc.update();
    }
  });

  return null;
}

/** Syncs React state when entering/leaving immersive WebXR (desktop vs headset). */
export function XrPresentingSync({
  onPresentingChange,
}: {
  onPresentingChange: (presenting: boolean) => void;
}) {
  const { gl } = useThree();
  const prev = useRef(false);
  useFrame(() => {
    const p = gl.xr.isPresenting;
    if (p !== prev.current) {
      prev.current = p;
      onPresentingChange(p);
    }
  });
  return null;
}
