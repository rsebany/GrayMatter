"use client";

import * as THREE from "three";
import type { XrPanel } from "./hooks/use-xr-panels";

type Props = {
  panels: XrPanel[];
  createTexture: (title: string) => THREE.CanvasTexture | null;
};

export function XrPanelsLayer({ panels, createTexture }: Props) {
  if (panels.length === 0) return null;
  return (
    <group name="xr-panels">
      {panels.map((p) => {
        const x = Math.sin(p.angle) * p.distance;
        const z = -Math.cos(p.angle) * p.distance;
        const tex = createTexture(p.title);
        return (
          <mesh key={p.id} position={[x, 1.4, z]} rotation={[0, p.angle, 0]}>
            <planeGeometry args={[p.size[0], p.size[1]]} />
            <meshBasicMaterial map={tex || undefined} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}
