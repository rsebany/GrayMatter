"use client";

import * as THREE from "three";
import { XR_CLINICAL_ZONE } from "@/lib/xr/layout-constants";

/** Dark procedural room when hospital GLTF assets are missing. */
export function DarkFallbackRoom() {
  const [cx, cy, cz] = XR_CLINICAL_ZONE.center;
  return (
    <group position={[cx, cy - 0.6, cz]}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[14, 5, 14]} />
        <meshBasicMaterial color="#111827" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#2a3441" roughness={0.92} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.019, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 40]} />
        <meshBasicMaterial color="#5b6674" transparent opacity={0.35} />
      </mesh>
      <pointLight position={[0, 2.8, 1.2]} intensity={0.35} color="#7dd3fc" />
      <pointLight position={[-2, 1.6, -1]} intensity={0.2} color="#94a3b8" />
    </group>
  );
}
