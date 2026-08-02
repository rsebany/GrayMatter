import { useRef } from "react";
import * as THREE from "three";
import { ProceduralBrain } from "@/components/features/viewer/xr/viewers/mesh/ProceduralBrain";
import type { BrainMeshProps } from "./brain-mesh.types";
import {
  useBrainMeshAutoRotate,
  useBrainMeshPointerHandlers,
} from "./use-brain-mesh-interaction";

type PlaceholderProps = Pick<
  BrainMeshProps,
  | "onWorldDragDelta"
  | "autoRotate"
  | "allowDrag"
  | "layoutGroupPosition"
>;

export function BrainMeshPlaceholder({
  onWorldDragDelta,
  autoRotate = true,
  allowDrag = true,
  layoutGroupPosition = [0, 1.2, 0.5],
}: PlaceholderProps) {
  const meshRef = useRef<THREE.Group>(null);
  const { isGrabbing, handlers } = useBrainMeshPointerHandlers({
    onWorldDragDelta,
    allowDrag,
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
      <ProceduralBrain />
    </group>
  );
}
