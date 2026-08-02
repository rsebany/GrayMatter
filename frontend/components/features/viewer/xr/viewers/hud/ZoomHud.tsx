"use client";

import React from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControlsHandle } from "../three-viewer-camera";
import { HUD_BTN, HUD_BTN_ACTIVE } from "./zoom-hud.styles";

export function ZoomHud({
  controlsRef,
  minDistance,
  maxDistance,
  flipVertical = false,
  onFlipVertical,
  flipVerticalDisabled = false,
}: {
  controlsRef: React.RefObject<OrbitControlsHandle | null>;
  minDistance: number;
  maxDistance: number;
  flipVertical?: boolean;
  onFlipVertical?: () => void;
  flipVerticalDisabled?: boolean;
}) {
  const { camera } = useThree();

  const applyZoom = (factor: number) => {
    const target = controlsRef.current?.target ?? new THREE.Vector3(0, 0, 0);
    const toCamera = camera.position.clone().sub(target);
    const currentDistance = Math.max(0.0001, toCamera.length());
    const nextDistance = THREE.MathUtils.clamp(currentDistance * factor, minDistance, maxDistance);
    toCamera.setLength(nextDistance);
    camera.position.copy(target.clone().add(toCamera));
    camera.updateProjectionMatrix();
    controlsRef.current?.update();
  };

  const showFlip = Boolean(onFlipVertical);

  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => applyZoom(0.85)}
          style={HUD_BTN}
        >
          +
        </button>
        {showFlip && (
          <button
            type="button"
            aria-label="Flip mesh vertically"
            aria-pressed={flipVertical}
            title="Flip vertical (apex ↔ base)"
            disabled={flipVerticalDisabled}
            onClick={onFlipVertical}
            style={{
              ...(flipVertical ? HUD_BTN_ACTIVE : HUD_BTN),
              opacity: flipVerticalDisabled ? 0.45 : 1,
              cursor: flipVerticalDisabled ? "not-allowed" : "pointer",
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            ↕
          </button>
        )}
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => applyZoom(1.15)}
          style={HUD_BTN}
        >
          −
        </button>
      </div>
    </Html>
  );
}
