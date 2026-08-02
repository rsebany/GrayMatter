"use client";

import React from "react";

type SegmentationClassLegendProps = {
  compact?: boolean;
  className?: string;
  palette?: "overlay2d" | "mesh3d";
};

const OVERLAY_ITEMS = [
  { label: "Left hippocampus", color: "bg-emerald-500" },
  { label: "Right hippocampus", color: "bg-indigo-500" },
] as const;

const MESH3D_ITEMS = [
  ...OVERLAY_ITEMS,
  { label: "Brain shell", color: "bg-slate-400" },
] as const;

export function SegmentationClassLegend({
  compact = false,
  className = "",
  palette = "overlay2d",
}: SegmentationClassLegendProps) {
  const title = palette === "mesh3d" ? "3D mesh colors" : "2D overlay colors";
  const items = palette === "mesh3d" ? MESH3D_ITEMS : OVERLAY_ITEMS;
  return (
    <div
      className={`rounded-xl border border-border/70 bg-card/90 px-3 py-2 backdrop-blur ${className}`}
      aria-label="Segmentation class legend"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className={`flex ${compact ? "gap-2" : "gap-3"} flex-wrap`}>
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
            <span className={`h-3 w-3 rounded-sm border border-black/20 ${item.color}`} />
            <span className="text-[11px] font-medium text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
