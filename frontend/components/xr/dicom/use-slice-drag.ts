"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { DRAG_STEP_PX } from "./constants";

export function useSliceDrag(
  onPausePlayback: () => void,
  updateSlice: (next: number) => void,
  currentSliceRef: RefObject<number>,
) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; lastX: number } | null>(null);

  const onSlicePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onPausePlayback();
      dragRef.current = { pointerId: e.pointerId, lastX: e.nativeEvent.clientX };
      setIsDragging(true);
      (e.object as THREE.Mesh).setPointerCapture(e.pointerId);
    },
    [onPausePlayback],
  );

  const onSlicePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const dragState = dragRef.current;
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const deltaX = e.nativeEvent.clientX - dragState.lastX;
      const absDelta = Math.abs(deltaX);
      if (absDelta < DRAG_STEP_PX) return;
      const steps = Math.trunc(absDelta / DRAG_STEP_PX);
      const direction = deltaX > 0 ? 1 : -1;
      dragState.lastX += steps * DRAG_STEP_PX * direction;
      updateSlice(currentSliceRef.current + steps * direction);
    },
    [updateSlice, currentSliceRef],
  );

  const onSlicePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    try {
      (e.object as THREE.Mesh).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  return { isDragging, setIsDragging, onSlicePointerDown, onSlicePointerMove, onSlicePointerUp, clearDrag };
}
