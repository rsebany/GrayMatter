"use client";

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneEulerRotation } from "@/lib/xr/scene-rotation";
import { STACK_FOCUS_OPACITY, STACK_PLANE_SIZE } from "./constants";

type Props = {
  texture: THREE.Texture;
  planeRotation: SceneEulerRotation;
  isDragging: boolean;
  showScrubHint: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
};

export function DicomSlicePlane({
  texture,
  planeRotation,
  isDragging,
  showScrubHint,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  return (
    <>
      <group rotation={planeRotation}>
        <mesh
          position={[0, 0, 0]}
          renderOrder={1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <planeGeometry args={[STACK_PLANE_SIZE, STACK_PLANE_SIZE]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={STACK_FOCUS_OPACITY}
            side={THREE.DoubleSide}
            depthWrite
          />
        </mesh>
      </group>
      {isDragging && showScrubHint ? (
        <Html position={[0, 0.85, 0]} center>
          <div className="rounded-full border border-green-500/60 bg-green-950/90 px-2.5 py-0.5 backdrop-blur-md animate-pulse">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-green-200">
              Scrubbing...
            </p>
          </div>
        </Html>
      ) : null}
    </>
  );
}
