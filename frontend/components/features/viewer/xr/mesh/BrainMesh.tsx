"use client";

import { BrainMeshCore } from "./BrainMeshCore";
import type { BrainMeshProps } from "./brain-mesh.types";
import { BrainMeshErrorBoundary } from "./BrainMeshErrorBoundary";

export type { BrainMeshProps } from "./brain-mesh.types";

const ErrorFallback = (
  <group position={[0, 1.2, 0.5]}>
    <mesh>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color="#ff4444" />
    </mesh>
  </group>
);

export function BrainMesh({ onLoadError, ...props }: BrainMeshProps) {
  return (
    <BrainMeshErrorBoundary fallback={ErrorFallback} onError={onLoadError}>
      <BrainMeshCore {...props} />
    </BrainMeshErrorBoundary>
  );
}
