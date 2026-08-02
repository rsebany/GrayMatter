"use client";

import React, { createContext, useContext, useRef, useCallback } from "react";

/** Context for resetting XR view (camera/origin position) */
const XRResetContext = createContext<(() => void) | null>(null);

export function useXRReset() {
  const reset = useContext(XRResetContext);
  return reset ?? (() => {});
}

type XRControllersProps = {
  children: React.ReactNode;
  onResetView?: () => void;
};

/**
 * Wraps interactive 3D content for VR controller interaction.
 * Controllers (ray + grab pointers) are provided by @react-three/xr XRElements.
 * Child meshes with pointer handlers (onPointerDown/Move/Up) support grab/rotate in VR.
 */
export function XRControllers({ children, onResetView }: XRControllersProps) {
  const resetRef = useRef(onResetView);
  resetRef.current = onResetView;

  const reset = useCallback(() => {
    resetRef.current?.();
  }, []);

  return (
    <XRResetContext.Provider value={reset}>
      {children}
    </XRResetContext.Provider>
  );
}
