"use client";

import { Button } from "@/components/ui/button";
import { ToolbarCluster } from "./ToolbarCluster";

type Props = { onZoomIn: () => void; onZoomOut: () => void };

export function ZoomToolbarGroup({ onZoomIn, onZoomOut }: Props) {
  const btn =
    "h-8 shrink-0 border-slate-500/40 bg-slate-950/70 px-2.5 text-xs text-slate-100 hover:bg-slate-800/80 sm:h-9";
  return (
    <ToolbarCluster label="Zoom">
      <Button type="button" variant="outline" size="sm" onClick={onZoomOut} className={btn}>
        -
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onZoomIn} className={btn}>
        +
      </Button>
    </ToolbarCluster>
  );
}
