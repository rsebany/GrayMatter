"use client";

import { useCallback, type RefObject } from "react";

export function useFullscreen(containerRef: RefObject<HTMLDivElement | null>) {
  return useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const el = containerRef.current ?? document.documentElement;
      const target = el as HTMLElement & { requestFullscreen?: () => Promise<void> };
      if (target.requestFullscreen) await target.requestFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }
  }, [containerRef]);
}
