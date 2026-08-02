"use client";

import { Button } from "@/components/ui/button";
import { MESH_CLASS_BUTTONS } from "./toolbar-constants";
import { ToolbarCluster } from "./ToolbarCluster";
import type { MeshClassVisibility } from "./types";

type Props = {
  meshClassVisibility: MeshClassVisibility;
  onToggleMeshClass: (key: keyof MeshClassVisibility) => void;
};

export function LayersToolbarGroup({ meshClassVisibility, onToggleMeshClass }: Props) {
  return (
    <ToolbarCluster label="Layers">
      {MESH_CLASS_BUTTONS.map((item) => {
        const isActive = meshClassVisibility[item.key];
        return (
          <Button
            key={item.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onToggleMeshClass(item.key)}
            className={`h-8 shrink-0 px-2 text-xs sm:h-9 sm:px-2.5 bg-slate-950/70 hover:bg-slate-900/85 ${
              isActive ? item.activeClass : "border-white/20 text-slate-300"
            }`}
          >
            {item.label}
          </Button>
        );
      })}
    </ToolbarCluster>
  );
}
