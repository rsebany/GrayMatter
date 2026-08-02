"use client";

import { useMemo } from "react";
import * as THREE from "three";

const LEFT_HIPPO_COLOR = 0x10b981;
const RIGHT_HIPPO_COLOR = 0x6366f1;
const BRAIN_SHELL_COLOR = 0xd8cfc4;

export function ProceduralBrain() {
  const shellMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(BRAIN_SHELL_COLOR),
        roughness: 0.68,
        metalness: 0.02,
        transmission: 0.12,
        thickness: 0.8,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const leftMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(LEFT_HIPPO_COLOR),
        emissive: new THREE.Color(LEFT_HIPPO_COLOR),
        emissiveIntensity: 0.28,
        roughness: 0.34,
        metalness: 0.06,
      }),
    [],
  );

  const rightMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(RIGHT_HIPPO_COLOR),
        emissive: new THREE.Color(RIGHT_HIPPO_COLOR),
        emissiveIntensity: 0.28,
        roughness: 0.34,
        metalness: 0.06,
      }),
    [],
  );

  return (
    <group userData={{ grabbable: true }}>
      <mesh material={shellMat} castShadow receiveShadow scale={[1.1, 0.95, 1.2]} renderOrder={1}>
        <icosahedronGeometry args={[0.55, 2]} />
      </mesh>
      <mesh
        material={leftMat}
        position={[-0.14, -0.02, 0.06]}
        scale={[0.22, 0.14, 0.28]}
        castShadow
        receiveShadow
        renderOrder={5}
      >
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <mesh
        material={rightMat}
        position={[0.14, -0.02, 0.06]}
        scale={[0.22, 0.14, 0.28]}
        castShadow
        receiveShadow
        renderOrder={5}
      >
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
    </group>
  );
}
