import { useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import * as THREE from "three";

export function useClippingPlane(
  clippingPlaneConstant: number,
  clippingPlaneNormal: [number, number, number] = [0, 1, 0],
) {
  const clippingPlane = useMemo(
    () =>
      new THREE.Plane(
        new THREE.Vector3(...clippingPlaneNormal),
        clippingPlaneConstant,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clippingPlaneNormal.join(",")],
  );
  clippingPlane.constant = clippingPlaneConstant;
  return clippingPlane;
}

export function useBrainMeshAutoRotate(
  meshRef: RefObject<THREE.Group | null>,
  autoRotate: boolean,
  isGrabbing: MutableRefObject<boolean>,
) {
  const xrSession = useXR((s) => s.session);
  useFrame((_, delta) => {
    if (!meshRef.current || xrSession) return;
    if (autoRotate && !isGrabbing.current) {
      meshRef.current.rotation.y += delta * 0.045;
    }
  });
}

type PointerDragOptions = {
  onWorldDragDelta?: (delta: THREE.Vector3) => void;
  allowDrag?: boolean;
  surfacePickMode?: boolean;
  onSurfacePick?: (worldPoint: THREE.Vector3) => void;
  meshRef: RefObject<THREE.Group | null>;
};

export function useBrainMeshPointerHandlers({
  onWorldDragDelta,
  allowDrag = true,
  surfacePickMode = false,
  onSurfacePick,
  meshRef,
}: PointerDragOptions) {
  const isGrabbing = useRef(false);
  const prevPointRef = useRef(new THREE.Vector3());

  const handlePointerDown = (e: {
    stopPropagation: () => void;
    point: THREE.Vector3;
    pointerId: number;
    target: unknown;
  }) => {
    if (surfacePickMode && onSurfacePick) {
      e.stopPropagation();
      onSurfacePick(e.point.clone());
      return;
    }
    if (isGrabbing.current) return;
    isGrabbing.current = true;
    prevPointRef.current.copy(e.point);
    (e.target as THREE.Object3D).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: { point: THREE.Vector3 }) => {
    if (!isGrabbing.current) return;
    const delta = e.point.clone().sub(prevPointRef.current);
    prevPointRef.current.copy(e.point);
    if (onWorldDragDelta) {
      onWorldDragDelta(delta);
      return;
    }
    if (!meshRef.current) return;
    meshRef.current.position.add(delta);
  };

  const handlePointerUp = (e: { pointerId: number; target: unknown }) => {
    isGrabbing.current = false;
    (e.target as THREE.Object3D).releasePointerCapture(e.pointerId);
  };

  if (surfacePickMode && onSurfacePick) {
    return { isGrabbing, handlers: { onPointerDown: handlePointerDown } };
  }
  if (!allowDrag) {
    return { isGrabbing, handlers: {} };
  }
  return {
    isGrabbing,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerUp,
    },
  };
}
