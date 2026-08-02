"use client";

import { ImmersiveButton } from "./ImmersiveButton";

export function ImmersiveToggleButton({
  label,
  active,
  position,
  activeColor,
  onSelect,
}: {
  label: string;
  active: boolean;
  position: [number, number, number];
  activeColor: string;
  onSelect: () => void;
}) {
  return (
    <ImmersiveButton
      label={label}
      position={position}
      color={active ? activeColor : "#1e293b"}
      onSelect={onSelect}
    />
  );
}
