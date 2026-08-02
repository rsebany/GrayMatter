"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { XROrigin, useXR, useXRControllerLocomotion } from "@react-three/xr";
import { XR_VR_SPAWN } from "@/lib/xr/layout-constants";

type Props = {
  /** Thumbstick move / turn only in VR; AR stays stationary (passthrough). */
  mode: "vr" | "ar";
  /** Increment to re-apply VR spawn pose when entering immersive. */
  vrSpawnNonce?: number;
};

/**
 * Parents the XR camera under a rig so thumbstick locomotion moves you through the scene
 * (desktop orbit controls handle navigation when not presenting).
 */
export function XrLocomotionRig({ mode, vrSpawnNonce = 0 }: Props) {
  const originRef = useRef<THREE.Group>(null);
  const session = useXR((s) => s.session);
  const presenting = Boolean(session);
  const enableLoco = presenting && mode === "vr";

  useXRControllerLocomotion(
    originRef,
    enableLoco ? { speed: 1.35 } : false,
    enableLoco
      ? {
          type: "snap",
          degrees: 35,
          deadZone: 0.22,
        }
      : false,
    "left",
  );

  useEffect(() => {
    if (!presenting || mode !== "vr") return;
    const origin = originRef.current;
    if (!origin) return;
    origin.position.set(XR_VR_SPAWN.originX, XR_VR_SPAWN.originY, XR_VR_SPAWN.originZ);
    origin.rotation.set(0, 0, 0);
  }, [presenting, mode, vrSpawnNonce]);

  return <XROrigin ref={originRef} disabled={!presenting} />;
}
