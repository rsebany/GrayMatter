"use client";

import { Html, Text } from "@react-three/drei";

export function DicomSliceLoadingState({
  position,
  useImmersive,
}: {
  position: [number, number, number];
  useImmersive: boolean;
}) {
  if (useImmersive) {
    return (
      <group position={position}>
        <mesh>
          <planeGeometry args={[0.55, 0.14]} />
          <meshBasicMaterial color="#0c4a6e" transparent opacity={0.9} />
        </mesh>
        <Text position={[0, 0, 0.01]} fontSize={0.035} color="#7dd3fc" anchorX="center" anchorY="middle">
          Loading slice…
        </Text>
      </group>
    );
  }
  return (
    <Html position={[0, 1.2, -0.2]} center>
      <div className="rounded-lg border border-blue-500/50 bg-blue-950/80 px-4 py-2 backdrop-blur-sm">
        <p className="text-xs font-medium text-blue-300">Loading DICOM slice...</p>
      </div>
    </Html>
  );
}
