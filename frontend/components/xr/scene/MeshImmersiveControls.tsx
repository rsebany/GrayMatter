"use client";

import { ImmersiveButton } from "../immersive-ui";

type Props = {
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onResetRotation: () => void;
  onFlip: () => void;
  onAddPanel: () => void;
  onClearPanels: () => void;
};

export function MeshImmersiveControls({
  onRotateLeft,
  onRotateRight,
  onResetRotation,
  onFlip,
  onAddPanel,
  onClearPanels,
}: Props) {
  return (
    <group position={[0, -0.95, 0.05]}>
      <ImmersiveButton label="↺" position={[-0.35, 0.38, 0]} color="#475569" width={0.2} onSelect={onRotateLeft} />
      <ImmersiveButton label="↻" position={[0.35, 0.38, 0]} color="#475569" width={0.2} onSelect={onRotateRight} />
      <ImmersiveButton label="0°" position={[0, 0.38, 0]} color="#334155" width={0.18} onSelect={onResetRotation} />
      <ImmersiveButton label="⇵" position={[0, 0.05, 0]} color="#0369a1" width={0.22} onSelect={onFlip} />
      <ImmersiveButton label="+Ecr" position={[0.75, 0.38, 0]} color="#0891b2" width={0.24} onSelect={onAddPanel} />
      <ImmersiveButton label="Clr" position={[0.75, 0.05, 0]} color="#475569" width={0.18} onSelect={onClearPanels} />
    </group>
  );
}
