"use client";

import { Html } from "@react-three/drei";
import * as THREE from "three";

export function XrSceneLoadingFallback() {
  return (
    <group>
      <mesh position={[0, 1.4, -2.4]}>
        <sphereGeometry args={[6, 24, 24]} />
        <meshBasicMaterial color="#050505" side={THREE.BackSide} />
      </mesh>
      <Html position={[0, 1.3, -0.75]} center>
        <div className="rounded-lg border border-cyan-500/30 bg-black/70 px-3 py-1.5">
          <p className="text-[10px] font-semibold tracking-wide text-cyan-200">Loading XR scene...</p>
        </div>
      </Html>
    </group>
  );
}
