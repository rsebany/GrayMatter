import React from "react";
import { Activity, Database, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { WindowPreset } from "@/lib/viewer/window-presets";

type Orientation = "axial" | "coronal" | "sagittal";

type View2DLeftPanelProps = {
  files: File[] | null;
  dicomLoadStatus: "idle" | "loading" | "loaded" | "failed";
  dicomLoadError: string | null;
  hasDicomInDb: boolean;
  hasVolume: boolean;
  serverVolumeDepth?: number;
  patientName?: string | null;
  studyLine?: string | null;
  studyModality: string;
  windowPresets: Record<string, WindowPreset>;
  windowPreset: string;
  windowCenter: number;
  windowWidth: number;
  denoise: boolean;
  orientation: Orientation;
  onFolderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onWindowPresetChange: (key: string, center: number, width: number) => void;
  onWindowLevelChange: (center: number, width: number) => void;
  onDenoiseChange: (value: boolean) => void;
  onOrientationChange: (orientation: Orientation) => void;
  onResetSliceIndex: () => void;
};

export function View2DLeftPanel({
  files,
  dicomLoadStatus,
  dicomLoadError,
  hasDicomInDb,
  hasVolume,
  serverVolumeDepth = 0,
  patientName,
  studyLine,
  studyModality,
  windowPresets,
  windowPreset,
  windowCenter,
  windowWidth,
  denoise,
  orientation,
  onFolderChange,
  onWindowPresetChange,
  onWindowLevelChange,
  onDenoiseChange,
  onOrientationChange,
  onResetSliceIndex,
}: View2DLeftPanelProps) {
  const sliceCount = files?.length ?? 0;
  const vaultSliceCount = serverVolumeDepth > 0 ? serverVolumeDepth : sliceCount;
  const showCaseIdentity = Boolean(patientName || studyLine || hasDicomInDb);
  const vaultCase = hasDicomInDb;
  const wlMax = 255;
  const wlMin = 0;
  const widthMin = 20;
  const widthMax = 255;

  return (
    <div className="flex w-full flex-col gap-3 overflow-y-auto pr-1">
      <section className="rounded-xl border border-graymatter-border bg-graymatter-card p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Database className="h-3.5 w-3.5" /> Case
        </h3>

        {showCaseIdentity && (
          <div className="mb-2 min-w-0 space-y-0.5 border-b border-border/60 pb-2">
            {patientName && (
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                {patientName}
              </p>
            )}
            {studyLine && (
              <p className="truncate text-[11px] text-muted-foreground" title={studyLine}>
                {studyLine}
              </p>
            )}
          </div>
        )}

        {hasDicomInDb && !hasVolume && dicomLoadStatus === "loading" && (
          <div className="mb-2 animate-pulse rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1.5 text-[10px] font-medium text-blue-500">
            Fetching study from vault…
          </div>
        )}

        {vaultCase ? (
          <div
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${
              hasVolume
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            <Layers
              className={`h-3.5 w-3.5 shrink-0 ${hasVolume ? "text-emerald-500" : "text-muted-foreground"}`}
            />
            <span className="min-w-0 flex-1 font-medium">
              {dicomLoadStatus === "loading"
                ? "Loading MRI…"
                : hasVolume
                  ? serverVolumeDepth > 0 && sliceCount === 0
                    ? `MRI volume ready (${vaultSliceCount} slices)`
                    : `${vaultSliceCount} axial slices`
                  : "MRI pending"}
            </span>
          </div>
        ) : (
          <label
            className={`group flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-all
            ${
              hasVolume
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "cursor-pointer border-border bg-muted hover:border-sky-500/50"
            }`}
          >
            <Layers
              className={`mb-1.5 h-5 w-5 ${
                hasVolume
                  ? "text-emerald-500"
                  : "text-muted-foreground group-hover:text-sky-500"
              }`}
            />
            <span className="text-xs font-medium text-foreground">
              {hasVolume ? "Series loaded" : "Load study folder"}
            </span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={onFolderChange}
              disabled={dicomLoadStatus === "loading"}
              // @ts-expect-error directory upload
              webkitdirectory=""
            />
            <span className="mt-2 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {hasVolume ? `${sliceCount} slices` : "Select directory"}
            </span>
          </label>
        )}

        {dicomLoadStatus === "failed" && dicomLoadError && (
          <p className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400">
            <Activity className="h-3 w-3 shrink-0 animate-pulse" />
            <span className="min-w-0">{dicomLoadError}</span>
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-graymatter-border bg-graymatter-card p-3">
        <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Activity className="h-3.5 w-3.5" /> Window
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(windowPresets).map(([key, preset]) => (
            <Button
              key={key}
              variant="outline"
              className={`h-8 rounded-md border-border text-[11px] transition-all ${
                windowPreset === key
                  ? "bg-sky-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-graymatter-card-hover"
              }`}
              onClick={() => onWindowPresetChange(key, preset.center, preset.width)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="space-y-2 border-t border-border/60 pt-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Center</span>
              <span className="font-mono text-foreground">{windowCenter}</span>
            </div>
            <input
              type="range"
              min={wlMin}
              max={wlMax}
              value={windowCenter}
              onChange={(e) =>
                onWindowLevelChange(parseInt(e.target.value, 10), windowWidth)
              }
              aria-label="Window center"
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Width</span>
              <span className="font-mono text-foreground">{windowWidth}</span>
            </div>
            <input
              type="range"
              min={widthMin}
              max={widthMax}
              value={windowWidth}
              onChange={(e) =>
                onWindowLevelChange(windowCenter, parseInt(e.target.value, 10))
              }
              aria-label="Window width"
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-foreground">Smooth</span>
            <span className="text-[9px] text-muted-foreground">Mild denoise</span>
          </div>
          <Switch
            checked={denoise}
            onCheckedChange={onDenoiseChange}
            aria-label="Enable mild slice denoise"
          />
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-graymatter-border bg-graymatter-card p-3">
        <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Layers className="h-3.5 w-3.5" /> Plane
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {(["axial", "coronal", "sagittal"] as const).map((plane) => (
            <Button
              key={plane}
              variant="outline"
              className={`h-8 rounded-md border-border text-[11px] capitalize transition-all ${
                orientation === plane
                  ? "bg-sky-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-graymatter-card-hover"
              }`}
              onClick={() => {
                onOrientationChange(plane);
                onResetSliceIndex();
              }}
              disabled={!hasVolume}
            >
              {plane}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
