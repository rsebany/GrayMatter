"use client";

import { useCallback, useState } from "react";
import type { XRStore } from "@react-three/xr";
import { preloadXrSessionAssets } from "../preload";
import type { XrExperienceMode } from "./types";

type Args = {
  mode: XrExperienceMode;
  store: XRStore;
  isImmersiveSupported: boolean;
  isCheckingSupport: boolean;
  studyId: string | null;
  effectiveMeshUrl: string;
  currentDicomSlice: number;
  onVrSpawn: () => void;
};

export function useImmersiveEntry({
  mode,
  store,
  isImmersiveSupported,
  isCheckingSupport,
  studyId,
  effectiveMeshUrl,
  currentDicomSlice,
  onVrSpawn,
}: Args) {
  const [xrError, setXrError] = useState<string | null>(null);
  const [preparingImmersive, setPreparingImmersive] = useState(false);

  const runEnterImmersive = useCallback(async () => {
    try {
      setXrError(null);
      if (isCheckingSupport) {
        setXrError("Checking XR support… please try again in a moment.");
        return;
      }
      if (!isImmersiveSupported) {
        setXrError(
          mode === "ar"
            ? "AR is not available on this browser. Open the app on an AR-capable Android Chrome device over HTTPS, or switch to VR."
            : "VR is not available on this browser. Use a compatible WebXR headset or open the desktop 3D view.",
        );
        return;
      }

      if (mode === "vr") {
        setPreparingImmersive(true);
        try {
          await preloadXrSessionAssets({
            studyId,
            meshUrl: effectiveMeshUrl,
            dicomSlice: currentDicomSlice,
            skipHeavyAssets: false,
          });
        } catch (preloadErr) {
          console.warn("XR preload incomplete:", preloadErr);
        } finally {
          setPreparingImmersive(false);
        }
        onVrSpawn();
        await store.enterVR();
        return;
      }
      await store.enterAR();
    } catch (err) {
      const label = mode === "ar" ? "AR" : "VR";
      let message = err instanceof Error ? err.message : `Failed to enter ${label}`;
      console.error("XR Error:", err);
      if (
        message.includes("NotSupportedError") ||
        message.includes("XRSession") ||
        message.includes("XRWebGLBinding")
      ) {
        message =
          mode === "ar"
            ? "AR session configuration is not supported on this phone/browser. Use Android Chrome over HTTPS on an ARCore-capable device, or switch to VR."
            : "No VR headset detected. Please connect a compatible WebXR device (e.g., Meta Quest, HTC Vive) or use desktop 3D view.";
      }
      setXrError(message);
    }
  }, [
    mode,
    store,
    isImmersiveSupported,
    isCheckingSupport,
    studyId,
    effectiveMeshUrl,
    currentDicomSlice,
    onVrSpawn,
  ]);

  const handleEnterImmersive = useCallback(
    async (onBalancedFocus: () => void) => {
      onBalancedFocus();
      if (mode === "vr") onVrSpawn();
      await runEnterImmersive();
    },
    [mode, onVrSpawn, runEnterImmersive],
  );

  const handleExitImmersive = useCallback(() => {
    void store.getState().session?.end();
  }, [store]);

  return { xrError, preparingImmersive, handleEnterImmersive, handleExitImmersive };
}
