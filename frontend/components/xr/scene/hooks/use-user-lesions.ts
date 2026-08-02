"use client";

import { useCallback, useState, type RefObject } from "react";
import * as THREE from "three";

export function useUserLesions(meshGroupRef: RefObject<THREE.Group | null>) {
  const [placingLesion, setPlacingLesion] = useState(false);
  const [userLesions, setUserLesions] = useState<
    Array<{ id: string; position: [number, number, number] }>
  >([]);

  const handleSurfacePick = useCallback((worldPoint: THREE.Vector3) => {
    const group = meshGroupRef.current;
    if (!group) return;
    const local = group.worldToLocal(worldPoint.clone());
    setUserLesions((prev) => [
      ...prev,
      { id: `lesion-${Date.now()}-${prev.length}`, position: [local.x, local.y, local.z] },
    ]);
    setPlacingLesion(false);
  }, [meshGroupRef]);

  const clearLesions = useCallback(() => setUserLesions([]), []);

  return {
    placingLesion,
    setPlacingLesion,
    userLesions,
    handleSurfacePick,
    clearLesions,
  };
}
