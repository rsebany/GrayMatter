"use client";

import {
  formatSegmentationVolumeNumber,
  formatSegmentationVolumeUnitLabel,
} from "@/lib/metrics/format-segmentation-volume";
import { computeTotalHippocampusBarFillPercent } from "@/lib/metrics/hippocampus-volume-bar";

type Props = {
  volumeTotalMm3: number;
  showWhenPending?: boolean;
  isCompleted: boolean;
};

/** Hippocampus volume with a fixed cm³ scale bar (worklist convention). */
export function StudyHippocampusBar({
  volumeTotalMm3,
  isCompleted,
  showWhenPending = false,
}: Props) {
  if (!isCompleted && !showWhenPending) {
    return <span className="text-xs text-muted-foreground italic">Calculating...</span>;
  }

  const volumeMm3 = Math.max(0, volumeTotalMm3);
  const fillPercent = computeTotalHippocampusBarFillPercent(volumeMm3);

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-24 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-sky-500 transition-[width]"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <span className="text-xs font-mono text-foreground">
        {formatSegmentationVolumeNumber("cm", { volumeMm3 })}
        <span className="ml-0.5 text-muted-foreground">
          {formatSegmentationVolumeUnitLabel("cm")}
        </span>
      </span>
    </div>
  );
}
