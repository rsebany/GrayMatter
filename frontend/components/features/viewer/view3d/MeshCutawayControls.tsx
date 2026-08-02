"use client";

import { Switch } from "@/components/ui/switch";

export type MeshCutawayState = {
  enabled: boolean;
  /** Three.js clipping plane constant (Y-up cut). */
  planeConstant: number;
};

export const DEFAULT_MESH_CUTAWAY: MeshCutawayState = {
  enabled: true,
  planeConstant: 0.12,
};

export const MESH_CUTAWAY_PLANE_NORMAL: [number, number, number] = [0, 1, 0];

type MeshCutawayControlsProps = {
  value: MeshCutawayState;
  onChange: (next: MeshCutawayState) => void;
  disabled?: boolean;
};

export function MeshCutawayControls({ value, onChange, disabled }: MeshCutawayControlsProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-graymatter-border bg-graymatter-card px-3 py-2 ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-foreground">Cutaway view</span>
        <span className="text-xs text-muted-foreground">Slice the brain to see hippocampus inside</span>
      </div>
      <Switch
        checked={value.enabled}
        onCheckedChange={(enabled) => onChange({ ...value, enabled })}
        disabled={disabled}
        aria-label="Enable cutaway clipping"
      />
      <label className="flex min-w-[140px] flex-1 items-center gap-2 sm:max-w-xs">
        <span className="shrink-0 text-xs text-muted-foreground">Cut depth</span>
        <input
          type="range"
          min={-0.8}
          max={0.8}
          step={0.02}
          value={value.planeConstant}
          disabled={disabled || !value.enabled}
          onChange={(e) =>
            onChange({ ...value, planeConstant: Number.parseFloat(e.target.value) })
          }
          className="h-1.5 flex-1 accent-rose-500"
          aria-label="Cutaway plane depth"
        />
      </label>
    </div>
  );
}
