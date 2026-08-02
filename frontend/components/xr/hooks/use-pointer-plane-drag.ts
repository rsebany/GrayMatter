"use client";

import { useCallback, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Drag in a plane facing the camera (through the initial hit point).
 * Disables OrbitControls while active; uses pointer capture on the event object.
 */
export function usePointerPlaneDrag(onDelta: (worldDelta: THREE.Vector3) => void) {
  const onDeltaRef = useRef(onDelta);
  onDeltaRef.current = onDelta;

  const { camera, invalidate } = useThree();
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | undefined;

  const active = useRef(false);
  const plane = useRef(new THREE.Plane());
  const lastHit = useRef(new THREE.Vector3());
  const normal = useRef(new THREE.Vector3());
  const hit = useRef(new THREE.Vector3());

  const down = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      active.current = true;
      camera.getWorldDirection(normal.current);
      plane.current.setFromNormalAndCoplanarPoint(normal.current, e.point);
      lastHit.current.copy(e.point);
      if (controls) controls.enabled = false;
      (e.object as THREE.Object3D).setPointerCapture(e.pointerId);
      invalidate();
    },
    [camera, controls, invalidate],
  );

  const move = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!active.current) return;
      if (!e.ray.intersectPlane(plane.current, hit.current)) return;
      const d = hit.current.clone().sub(lastHit.current);
      lastHit.current.copy(hit.current);
      if (d.lengthSq() > 0) onDeltaRef.current(d);
      invalidate();
    },
    [camera, invalidate],
  );

  const up = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!active.current) return;
      active.current = false;
      if (controls) controls.enabled = true;
      try {
        (e.object as THREE.Object3D).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      invalidate();
    },
    [controls, invalidate],
  );

  const cancel = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    if (controls) controls.enabled = true;
    invalidate();
  }, [controls, invalidate]);

  return useMemo(
    () => ({ down, move, up, cancel, active }),
    [down, move, up, cancel],
  );
}
