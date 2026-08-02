"use client";

import { useEffect, useState } from "react";

export type WebXrSessionMode = "immersive-vr" | "immersive-ar";

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function hasSecureWebXRContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.isSecureContext || isLocalhost(window.location.hostname);
}

/**
 * Whether this browser/device supports a WebXR immersive session mode.
 */
export function useWebXrSessionSupport(
  mode: WebXrSessionMode,
): { supported: boolean; isChecking: boolean } {
  const [state, setState] = useState({ supported: false, isChecking: true });

  useEffect(() => {
    setState({ supported: false, isChecking: true });

    if (typeof navigator === "undefined" || !("xr" in navigator)) {
      setState({ supported: false, isChecking: false });
      return;
    }

    if (!hasSecureWebXRContext()) {
      setState({ supported: false, isChecking: false });
      return;
    }

    const xr = (
      navigator as Navigator & {
        xr?: { isSessionSupported?: (m: string) => Promise<boolean> };
      }
    ).xr;

    xr?.isSessionSupported
      ?.call(xr, mode)
      .then((ok: boolean) => {
        setState({ supported: ok, isChecking: false });
        if (!ok) {
          console.warn(`WebXR ${mode} not supported on this device`);
        }
      })
      .catch(() => {
        setState({ supported: false, isChecking: false });
        console.warn("WebXR API not available");
      });
  }, [mode]);

  return state;
}
