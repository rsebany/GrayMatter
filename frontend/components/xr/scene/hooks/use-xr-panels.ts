"use client";

import { useCallback, useState } from "react";
import * as THREE from "three";

export type XrPanel = {
  id: string;
  title: string;
  angle: number;
  distance: number;
  size: [number, number];
};

export function useXrPanels() {
  const [panels, setPanels] = useState<XrPanel[]>([]);

  const createPanelTexture = useCallback((title: string) => {
    const w = 512;
    const h = 320;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#071022";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#a5f3fc";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, w / 2, 60);
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "16px sans-serif";
    ctx.fillText("Contenu XR — exemple de panneau", w / 2, 110);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  const addPanel = useCallback(() => {
    setPanels((prev) => {
      const next = prev.length;
      const spread = Math.min(5, next + 1);
      const angle = (next - (spread - 1) / 2) * (Math.PI / 10);
      return [
        ...prev,
        { id: `panel-${Date.now()}`, title: `Screen ${next + 1}`, angle, distance: 1.2, size: [0.9, 0.56] },
      ];
    });
  }, []);

  const clearPanels = useCallback(() => setPanels([]), []);

  return { panels, createPanelTexture, addPanel, clearPanels };
}
