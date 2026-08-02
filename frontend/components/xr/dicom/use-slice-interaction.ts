"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  type SceneEulerRotation,
  stepRotationY,
  ZERO_ROTATION,
} from "@/lib/xr/scene-rotation";
import { useSliceDrag } from "./use-slice-drag";

export function useSliceInteraction({
  maxSlices,
  currentSlice,
  onSliceChange,
  onPausePlayback,
  layoutPosition,
  anchorPosition,
}: {
  maxSlices: number;
  currentSlice: number;
  onSliceChange: (slice: number) => void;
  onPausePlayback: () => void;
  layoutPosition?: [number, number, number];
  anchorPosition?: [number, number, number];
}) {
  const [position, setPosition] = useState<[number, number, number]>(() => layoutPosition ?? [0, 1.2, 0]);
  const [planeRotation, setPlaneRotation] = useState<SceneEulerRotation>(ZERO_ROTATION);
  const currentSliceRef = useRef(currentSlice);

  useEffect(() => {
    currentSliceRef.current = currentSlice;
  }, [currentSlice]);

  useEffect(() => {
    if (layoutPosition && !anchorPosition) setPosition(layoutPosition);
  }, [layoutPosition, anchorPosition]);

  useEffect(() => {
    if (anchorPosition) setPosition(anchorPosition);
  }, [anchorPosition]);

  const clampSlice = useCallback(
    (next: number) => Math.max(0, Math.min(maxSlices - 1, next)),
    [maxSlices],
  );

  const updateSlice = useCallback(
    (next: number) => {
      const clamped = clampSlice(next);
      if (clamped === currentSliceRef.current) return;
      onSliceChange(clamped);
    },
    [clampSlice, onSliceChange],
  );

  const handlePrevSlice = useCallback(() => {
    onPausePlayback();
    updateSlice(currentSliceRef.current - 1);
  }, [onPausePlayback, updateSlice]);

  const handleNextSlice = useCallback(() => {
    onPausePlayback();
    updateSlice(currentSliceRef.current + 1);
  }, [onPausePlayback, updateSlice]);

  const rotatePlaneY = useCallback((direction: 1 | -1) => {
    setPlaneRotation((current) => stepRotationY(current, direction));
  }, []);

  const resetPlaneRotation = useCallback(() => setPlaneRotation(ZERO_ROTATION), []);

  const drag = useSliceDrag(onPausePlayback, updateSlice, currentSliceRef as RefObject<number>);

  return {
    ...drag,
    position,
    planeRotation,
    handlePrevSlice,
    handleNextSlice,
    rotatePlaneY,
    resetPlaneRotation,
    updateSlice,
  };
}
