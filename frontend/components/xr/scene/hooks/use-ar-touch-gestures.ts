"use client";

import { useEffect, useRef, useState } from "react";
import type { Camera, WebGLRenderer } from "three";
import * as THREE from "three";
import { XR_CLINICAL_ZONE } from "@/lib/xr/layout-constants";

const ENABLE_AR_TAP_PLACEMENT = false;
const ZOOM_STEP_PX = 22;
const TAP_MOVE_THRESHOLD = 10;

export function useArTouchGestures({
  sceneVariant,
  isPresenting,
  camera,
  gl,
  onZoomIn,
  onZoomOut,
  placeInFront,
  setArAnchor,
}: {
  sceneVariant: "vr" | "ar";
  isPresenting: boolean;
  camera: Camera;
  gl: WebGLRenderer;
  onZoomIn: () => void;
  onZoomOut: () => void;
  placeInFront: () => void;
  setArAnchor: (anchor: [number, number, number]) => void;
}) {
  const [arPlaced, setArPlaced] = useState(false);
  const arRaycasterRef = useRef(new THREE.Raycaster());
  const pinchStateRef = useRef<{ active: boolean; distance: number }>({ active: false, distance: 0 });
  const touchStateRef = useRef({ startX: 0, startY: 0, moved: false, hadPinch: false });

  useEffect(() => {
    if (!(sceneVariant === "ar" && isPresenting)) return;
    const element = gl.domElement;
    const pinch = pinchStateRef.current;
    const touchState = touchStateRef.current;

    const distanceBetweenTouches = (touches: TouchList) => {
      const a = touches[0];
      const b = touches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const resetPinch = () => {
      pinch.active = false;
      pinch.distance = 0;
      touchState.hadPinch = false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if ((event.target as HTMLElement | null)?.closest("button,input,select,textarea")) return;
      if (event.touches.length === 1) {
        touchState.startX = event.touches[0].clientX;
        touchState.startY = event.touches[0].clientY;
        touchState.moved = false;
      }
      if (event.touches.length === 2) {
        pinch.active = true;
        touchState.hadPinch = true;
        pinch.distance = distanceBetweenTouches(event.touches);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if ((event.target as HTMLElement | null)?.closest("button,input,select,textarea")) return;
      if (!pinch.active || event.touches.length !== 2) return;
      const nextDistance = distanceBetweenTouches(event.touches);
      const delta = nextDistance - pinch.distance;
      if (Math.abs(delta) >= ZOOM_STEP_PX) {
        if (delta > 0) onZoomIn();
        else onZoomOut();
        pinch.distance = nextDistance;
      }
      event.preventDefault();
    };

    const onTouchMoveSingle = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - touchState.startX;
      const dy = event.touches[0].clientY - touchState.startY;
      if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) touchState.moved = true;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!ENABLE_AR_TAP_PLACEMENT) return;
      if ((event.target as HTMLElement | null)?.closest("button,input,select,textarea")) return;
      if (touchState.hadPinch || touchState.moved) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const canvasRect = element.getBoundingClientRect();
      const x = ((touch.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
      const y = -((touch.clientY - canvasRect.top) / canvasRect.height) * 2 + 1;
      const raycaster = arRaycasterRef.current;
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -XR_CLINICAL_ZONE.center[1]);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(floorPlane, hit)) {
        placeAndMark();
        return;
      }
      setArAnchor([hit.x, XR_CLINICAL_ZONE.center[1], hit.z]);
      setArPlaced(true);
    };

    const placeAndMark = () => {
      placeInFront();
      setArPlaced(true);
    };

    if (!arPlaced) placeAndMark();

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchmove", onTouchMoveSingle, { passive: true });
    element.addEventListener("touchend", onTouchEnd, { passive: true });
    element.addEventListener("touchend", resetPinch, { passive: true });
    element.addEventListener("touchcancel", resetPinch, { passive: true });

    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchmove", onTouchMoveSingle);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchend", resetPinch);
      element.removeEventListener("touchcancel", resetPinch);
      resetPinch();
    };
  }, [arPlaced, camera, gl, isPresenting, onZoomIn, onZoomOut, placeInFront, sceneVariant, setArAnchor]);

  return { arPlaced };
}
