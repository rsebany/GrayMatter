"use client";

import { Text } from "@react-three/drei";
import { ImmersiveButton } from "../immersive-ui";

type Props = {
  currentSlice: number;
  maxSlices: number;
  isPlaying: boolean;
  onPrev: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onResetRotation: () => void;
};

export function DicomImmersiveControls({
  currentSlice,
  maxSlices,
  isPlaying,
  onPrev,
  onTogglePlay,
  onNext,
  onRotateLeft,
  onRotateRight,
  onResetRotation,
}: Props) {
  return (
    <group position={[0, -0.95, 0.05]}>
      <Text position={[0, 0.22, 0.02]} fontSize={0.038} color="#93c5fd" anchorX="center" anchorY="middle">
        {`${currentSlice + 1} / ${maxSlices}`}
      </Text>
      <ImmersiveButton label="Prev" position={[-0.42, 0, 0]} color="#1e3a8a" width={0.22} onSelect={onPrev} />
      <ImmersiveButton
        label={isPlaying ? "Pause" : "Play"}
        position={[0, 0, 0]}
        color="#0891b2"
        width={0.26}
        onSelect={onTogglePlay}
      />
      <ImmersiveButton label="Next" position={[0.42, 0, 0]} color="#1d4ed8" width={0.22} onSelect={onNext} />
      <ImmersiveButton label="↺" position={[-0.55, -0.38, 0]} color="#475569" width={0.2} onSelect={onRotateLeft} />
      <ImmersiveButton label="↻" position={[0.55, -0.38, 0]} color="#475569" width={0.2} onSelect={onRotateRight} />
      <ImmersiveButton label="0°" position={[0, -0.38, 0]} color="#334155" width={0.18} onSelect={onResetRotation} />
    </group>
  );
}
