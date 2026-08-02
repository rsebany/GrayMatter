"use client";

import { useEffect, type RefObject } from "react";
import type { Camera } from "three";
import { clinicalWorldPosition, xrPreviewCameraPose } from "@/lib/xr/layout-constants";

type OrbitRef = { target?: { set: (x: number, y: number, z: number) => void }; update?: () => void } | null;

export function useCameraFocus(
  camera: Camera,
  controlsRef: RefObject<unknown>,
  focusStackNonce: number,
  focusMeshNonce: number,
  focusBalancedNonce: number,
) {
  useEffect(() => {
    if (focusStackNonce === 0) return;
    const [dx, dy, dz] = clinicalWorldPosition("dicom");
    camera.position.set(dx - 0.35, dy + 0.12, dz + 1.55);
    const ctrl = controlsRef.current as OrbitRef;
    ctrl?.target?.set(dx, dy, dz);
    ctrl?.update?.();
  }, [focusStackNonce, camera, controlsRef]);

  useEffect(() => {
    if (focusMeshNonce === 0) return;
    const [mx, my, mz] = clinicalWorldPosition("mesh");
    camera.position.set(mx + 0.35, my + 0.12, mz + 1.85);
    const ctrl = controlsRef.current as OrbitRef;
    ctrl?.target?.set(mx, my, mz);
    ctrl?.update?.();
  }, [focusMeshNonce, camera, controlsRef]);

  useEffect(() => {
    if (focusBalancedNonce === 0) return;
    const { position, target } = xrPreviewCameraPose();
    camera.position.set(...position);
    const ctrl = controlsRef.current as OrbitRef;
    ctrl?.target?.set(...target);
    ctrl?.update?.();
  }, [focusBalancedNonce, camera, controlsRef]);
}
