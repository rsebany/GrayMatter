"use client";

import { ContactShadows, Environment } from "@react-three/drei";

type ThreeViewerLightingProps = {
  useStudioWhiteLighting: boolean;
  useAnatomicalLighting: boolean;
};

export function ThreeViewerLighting({
  useStudioWhiteLighting,
  useAnatomicalLighting,
}: ThreeViewerLightingProps) {
  const shadowOpacity = useStudioWhiteLighting ? 0.2 : useAnatomicalLighting ? 0.32 : 0.28;
  const shadowBlur = useStudioWhiteLighting ? 2.8 : useAnatomicalLighting ? 2.4 : 2.2;

  return (
    <>
      {useStudioWhiteLighting ? (
        <>
          <ambientLight intensity={0.65} color="#ffffff" />
          <directionalLight position={[2.8, 4.6, 2.6]} intensity={1.25} color="#ffffff" />
          <directionalLight position={[-2.2, 1.5, -1.8]} intensity={0.35} color="#e5ecff" />
          <Environment preset="studio" />
        </>
      ) : useAnatomicalLighting ? (
        <>
          <hemisphereLight args={["#fff4ee", "#1c2438", 0.72]} position={[0, 8, 0]} />
          <directionalLight position={[2.4, 5.5, 2.8]} intensity={1.35} color="#fff8f2" />
          <directionalLight position={[-2.8, 3.2, -1.6]} intensity={0.42} color="#c8d8f0" />
          <directionalLight position={[0.4, -1.2, 3.6]} intensity={0.22} color="#ffc8bc" />
          <ambientLight intensity={0.28} color="#8a9ab8" />
          <Environment preset="apartment" />
        </>
      ) : (
        <>
          <hemisphereLight args={["#f0e8e0", "#1a1a2e", 0.6]} position={[0, 5, 0]} />
          <directionalLight position={[3.2, 6, 2.2]} intensity={1.65} color="#fff5ed" />
          <directionalLight position={[-2.2, 2, -1.2]} intensity={0.5} color="#9eb8d8" />
          <directionalLight position={[-0.2, 0, 4.5]} intensity={0.35} color="#ffe0dc" />
          <ambientLight intensity={0.2} color="#5c6a8a" />
          <Environment preset="dawn" />
        </>
      )}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={shadowOpacity}
        scale={10}
        blur={shadowBlur}
        far={3.2}
        color="#0b1020"
      />
    </>
  );
}
