import { useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BrainMeshClipping } from "./brain-mesh-clipping";
import type { BrainMeshProps } from "./brain-mesh.types";
import {
  useBrainMeshAutoRotate,
  useBrainMeshPointerHandlers,
} from "./use-brain-mesh-interaction";
import type { MeshVisualPreset } from "../viewers/three-viewer.types";

export function BrainMeshGltf(
  props: Omit<BrainMeshProps, "usePlaceholder" | "onLoadError">,
) {
  const {
    meshUrl,
    solidBrainEnabled = false,
    classVisibility,
    onWorldDragDelta,
    autoRotate = true,
    allowDrag = true,
    layoutGroupPosition = [0, 1.2, 0.5],
    surfacePickMode = false,
    onSurfacePick,
  } = props;
  const { scene } = useGLTF(meshUrl);
  const meshRef = useRef<THREE.Group>(null);
  const visualPreset: MeshVisualPreset = solidBrainEnabled
    ? "anatomicalBrain"
    : "anatomicalBrainSemi";
  const { isGrabbing, handlers } = useBrainMeshPointerHandlers({
    onWorldDragDelta,
    allowDrag,
    surfacePickMode,
    onSurfacePick,
    meshRef,
  });
  useBrainMeshAutoRotate(meshRef, autoRotate, isGrabbing);

  return (
    <group
      ref={meshRef}
      userData={allowDrag ? { grabbable: true } : undefined}
      position={layoutGroupPosition}
      scale={0.5}
      {...handlers}
    >
      <BrainMeshClipping
        scene={scene}
        classVisibility={classVisibility}
        visualPreset={visualPreset}
      />
    </group>
  );
}
