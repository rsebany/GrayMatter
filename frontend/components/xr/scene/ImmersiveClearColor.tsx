"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import * as THREE from "three";

const OPAQUE_CLEAR = 0x111827;

/** Inline preview uses opaque clear; immersive AR passthrough uses transparent clear. */
export function ImmersiveClearColor({ sceneVariant }: { sceneVariant: "vr" | "ar" }) {
  const { gl, scene } = useThree();
  const session = useXR((s) => s.session);
  const presenting = Boolean(session);
  const blendMode = session?.environmentBlendMode;
  const isVrSession = presenting && sceneVariant === "vr";
  const immersivePassthrough =
    presenting &&
    sceneVariant === "ar" &&
    (blendMode === "alpha-blend" || blendMode === "additive");
  const solidRef = useRef(new THREE.Color("#111827"));

  const applyTransparentClear = () => {
    scene.background = null;
    gl.setClearColor(0x000000, 0);
  };

  const applyOpaqueClear = () => {
    scene.background = solidRef.current;
    gl.setClearColor(OPAQUE_CLEAR, 1);
  };

  const shouldUseOpaqueClear = !presenting || isVrSession || !immersivePassthrough;

  useEffect(() => {
    const previousBackground = scene.background;
    const previousClear = gl.getClearColor(new THREE.Color()).clone();
    const previousAlpha = gl.getClearAlpha();
    if (shouldUseOpaqueClear) applyOpaqueClear();
    else applyTransparentClear();
    return () => {
      scene.background = previousBackground;
      gl.setClearColor(previousClear, previousAlpha);
    };
  }, [shouldUseOpaqueClear, gl, scene]);

  useFrame(() => {
    if (shouldUseOpaqueClear) {
      if (scene.background !== solidRef.current || gl.getClearAlpha() !== 1) applyOpaqueClear();
      return;
    }
    if (scene.background !== null || gl.getClearAlpha() !== 0) applyTransparentClear();
  });

  return null;
}
