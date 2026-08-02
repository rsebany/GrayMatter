import React from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

type XRCanvasContainerProps = {
  children: React.ReactNode;
  backgroundColor?: string;
  /** ACES tone mapping + exposure for MeshPhysicalMaterial (anatomical lung). */
  usePhysicalToneMapping?: boolean;
};

export function XRCanvasContainer({
  children,
  backgroundColor = "#020617",
  usePhysicalToneMapping = false,
}: XRCanvasContainerProps) {
  return (
    <div className="relative h-full w-full rounded-xl bg-slate-900/60">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
        className="rounded-xl"
        orthographic={false}
        onCreated={({ gl }) => {
          if (usePhysicalToneMapping) {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.15;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            console.warn("WebGL context lost, attempting to restore…");
          });
          gl.domElement.addEventListener("webglcontextrestored", () => {
            console.log("WebGL context restored");
          });
        }}
      >
        <color attach="background" args={[backgroundColor]} />
        {children}
      </Canvas>
    </div>
  );
}
