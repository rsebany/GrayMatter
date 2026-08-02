"use client";

import { Button } from "@/components/ui/button";
import { ToolbarCluster } from "./ToolbarCluster";

type Props = {
  onPresetAll: () => void;
  onPresetLesions: () => void;
  onPresetShell: () => void;
};

export function PresetsToolbarGroup({ onPresetAll, onPresetLesions, onPresetShell }: Props) {
  const btn = "h-8 shrink-0 bg-slate-950/70 px-2 text-xs sm:h-9 sm:px-2.5";
  return (
    <ToolbarCluster label="Presets">
      <Button type="button" variant="outline" size="sm" onClick={onPresetAll} className={`${btn} border-sky-500/40 text-sky-100 hover:bg-sky-950/80`}>
        All
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onPresetLesions} className={`${btn} border-violet-500/40 text-violet-100 hover:bg-violet-950/80`}>
        Hippocampus
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onPresetShell} className={`${btn} border-slate-500/40 text-slate-100 hover:bg-slate-800/80`}>
        Brain
      </Button>
    </ToolbarCluster>
  );
}
