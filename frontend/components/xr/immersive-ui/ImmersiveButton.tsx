"use client";

import { Text } from "@react-three/drei";
import { Interactive } from "@react-three/xr";

export function ImmersiveButton({
  label,
  position,
  color,
  onSelect,
  width = 0.24,
  height = 0.11,
}: {
  label: string;
  position: [number, number, number];
  color: string;
  onSelect: () => void;
  width?: number;
  height?: number;
}) {
  return (
    <Interactive onSelect={onSelect}>
      <group position={position}>
        <mesh>
          <boxGeometry args={[width, height, 0.03]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Text position={[0, 0, 0.02]} fontSize={0.04} color="#e2e8f0" anchorX="center" anchorY="middle">
          {label}
        </Text>
      </group>
    </Interactive>
  );
}
