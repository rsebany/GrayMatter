"use client";

import { useEffect, useMemo, useRef } from "react";
import { createXRStore } from "@react-three/xr";
import { preloadXrSessionAssets } from "../preload";
import { useWebXrSessionSupport, useXrPresenting } from "@/hooks/xr";
import type { XrExperienceMode } from "./types";

export function useXrSessionStore(
  mode: XrExperienceMode,
  opts: {
    studyId: string | null;
    meshUrl: string;
    dicomSlice: number;
    arPerformanceMode: boolean;
  },
) {
  const sessionMode = mode === "ar" ? "immersive-ar" : "immersive-vr";
  const { supported, isChecking } = useWebXrSessionSupport(sessionMode);
  const shouldOffer = supported && !isChecking;

  const store = useMemo(
    () => createXRStore({ offerSession: shouldOffer ? sessionMode : false, emulate: false }),
    [sessionMode, shouldOffer],
  );
  const isPresenting = useXrPresenting(store);
  const preloadOnSessionRef = useRef(false);

  useEffect(() => {
    return store.subscribe((state, prev) => {
      if (prev.session == null && state.session != null && !preloadOnSessionRef.current) {
        preloadOnSessionRef.current = true;
        void preloadXrSessionAssets({
          studyId: opts.studyId,
          meshUrl: opts.meshUrl,
          dicomSlice: opts.dicomSlice,
          skipHeavyAssets: opts.arPerformanceMode,
        }).catch((err) => console.warn("XR preload on session start:", err));
      }
      if (state.session == null) preloadOnSessionRef.current = false;
    });
  }, [store, opts.studyId, opts.meshUrl, opts.dicomSlice, opts.arPerformanceMode]);

  return { store, isPresenting, isImmersiveSupported: supported, isCheckingSupport: isChecking };
}
