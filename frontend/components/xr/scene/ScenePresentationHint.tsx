"use client";

import { Html, Text } from "@react-three/drei";

export function ScenePresentationHint({ sceneVariant }: { sceneVariant: "vr" | "ar" }) {
  const message =
    sceneVariant === "vr"
      ? "Thumbstick move · Ray-select controls"
      : "Pinch zoom · Ray-select · Center to recenter";

  return (
    <Html prepend fullscreen style={{ pointerEvents: "none" }}>
      <p className="fixed bottom-24 left-1/2 z-10 max-w-xs -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-center text-[9px] text-slate-400 backdrop-blur-sm">
        {message}
      </p>
    </Html>
  );
}

export function ArPlacementHint({
  visible,
  position,
}: {
  visible: boolean;
  position: [number, number, number];
}) {
  if (!visible) return null;
  return (
    <Text
      position={[position[0], position[1] + 1.1, position[2]]}
      fontSize={0.045}
      color="#a5f3fc"
      anchorX="center"
      anchorY="middle"
      maxWidth={2.2}
    >
      Stabilize tracking, then Center
    </Text>
  );
}
