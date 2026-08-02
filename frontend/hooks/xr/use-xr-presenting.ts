"use client";

import { useEffect, useState } from "react";
import type { XRStore } from "@react-three/xr";

/** Tracks whether an immersive WebXR session is active on the given XR store. */
export function useXrPresenting(store: XRStore): boolean {
  const [isPresenting, setIsPresenting] = useState(() =>
    Boolean(store.getState().session),
  );

  useEffect(() => {
    return store.subscribe((state) => {
      setIsPresenting(state.session != null);
    });
  }, [store]);

  return isPresenting;
}
