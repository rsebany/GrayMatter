"use client";

type Lesion = { id: string; position: [number, number, number] };

export function UserLesionMarkers({ lesions }: { lesions: Lesion[] }) {
  return (
    <>
      {lesions.map((lesion) => (
        <mesh key={lesion.id} position={lesion.position} renderOrder={2}>
          <sphereGeometry args={[0.045, 14, 14]} />
          <meshStandardMaterial
            color="#4ade80"
            emissive="#166534"
            emissiveIntensity={0.65}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}
    </>
  );
}
