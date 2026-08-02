"use client";

import { useCallback, useEffect, useState } from "react";

export function useDicomPlayback(dicomSliceCount: number, setCurrentDicomSlice: (fn: (prev: number) => number) => void) {
  const [isDicomPlaying, setIsDicomPlaying] = useState(false);

  const pauseDicomPlayback = useCallback(() => setIsDicomPlaying(false), []);
  const toggleDicomPlayback = useCallback(() => setIsDicomPlaying((prev) => !prev), []);

  useEffect(() => {
    if (dicomSliceCount <= 1 && isDicomPlaying) setIsDicomPlaying(false);
  }, [dicomSliceCount, isDicomPlaying]);

  useEffect(() => {
    if (!isDicomPlaying || dicomSliceCount <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentDicomSlice((prev) => (prev + 1) % dicomSliceCount);
    }, 170);
    return () => window.clearInterval(timer);
  }, [dicomSliceCount, isDicomPlaying, setCurrentDicomSlice]);

  return { isDicomPlaying, pauseDicomPlayback, toggleDicomPlayback };
}
