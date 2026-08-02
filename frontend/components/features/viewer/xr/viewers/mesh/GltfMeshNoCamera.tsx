"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { applyBrainAnatomicalOrientation } from "@/lib/xr/brain-orientation";
import { tagMeshClassKeys } from "@/lib/xr/resolve-mesh-class-key";
import type { MeshClassVisibility, MeshVisualPreset } from "../three-viewer.types";
import { applyBrainPbrToScene, classKeyOf } from "./brain-pbr";

export function GltfMeshNoCamera({
  meshUrl,
  visualPreset,
  classVisibility,
}: {
  meshUrl: string;
  visualPreset: MeshVisualPreset;
  classVisibility: Required<MeshClassVisibility>;
}) {
  const { scene } = useGLTF(meshUrl);
  const root = useRef<THREE.Group | null>(null);

  const prepared = useMemo(() => {
    const c = scene.clone();
    c.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    tagMeshClassKeys(c);
    applyBrainAnatomicalOrientation(c);
    applyBrainPbrToScene(c, visualPreset);
    return c;
  }, [scene, meshUrl, visualPreset]);

  useLayoutEffect(() => {
    prepared.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const key = classKeyOf(child);
      if (!key) return;
      child.visible = classVisibility[key];
    });
  }, [prepared, classVisibility]);

  useLayoutEffect(() => {
    return () => {
      prepared.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    };
  }, [prepared]);

  return (
    <group ref={root} userData={{ grabbable: true }}>
      <Center>
        <primitive object={prepared} dispose={null} />
      </Center>
    </group>
  );
}
