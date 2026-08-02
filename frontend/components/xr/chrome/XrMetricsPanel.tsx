"use client";

import type { StudyMetrics } from "@/api/domain";
import { TotalIldVolumeLine } from "@/components/metrics";
import { useVolumeDisplayUnit } from "@/hooks/settings";
import {
  leftHippocampusBurden,
  leftHippocampusMl,
  rightHippocampusBurden,
  rightHippocampusMl,
  hippocampusBurden,
} from "@/lib/metrics/hippocampus-metrics";
import { formatSegmentationVolume } from "@/lib/metrics/format-segmentation-volume";

type Props = {
  metrics: StudyMetrics;
};

function resolveClassVolumeMl(
  lungMl: number | null | undefined,
  ml?: number | null,
  burden?: number | null,
): number | null {
  let volumeMl: number | null = ml ?? null;
  if (volumeMl == null && lungMl != null && lungMl > 0 && burden != null) {
    volumeMl = burden * lungMl;
  }
  if (volumeMl == null && burden === 0) volumeMl = 0;
  return volumeMl;
}

/** Minimal metrics strip for XR. */
export function XrMetricsPanel({ metrics }: Props) {
  const displayUnit = useVolumeDisplayUnit();
  const lungMl = metrics.lung_volume_ml;
  const burden = hippocampusBurden(metrics);
  const classVolumeRows = [
    {
      key: "left",
      label: "Left",
      ml: leftHippocampusMl(metrics),
      burden: leftHippocampusBurden(metrics),
      colorClass: "text-emerald-300",
    },
    {
      key: "right",
      label: "Right",
      ml: rightHippocampusMl(metrics),
      burden: rightHippocampusBurden(metrics),
      colorClass: "text-violet-300",
    },
  ] as const;

  return (
    <div className="pointer-events-auto w-full max-w-[11rem] rounded-lg border border-white/10 bg-slate-900/85 px-2.5 py-2 backdrop-blur-md sm:max-w-[13rem]">
      <TotalIldVolumeLine
        volumeTotalMm3={metrics.volume_total_mm3}
        burdenFraction={burden}
        displayUnit={displayUnit}
        valueClassName="text-base font-bold leading-tight text-white sm:text-lg"
        unitClassName="ml-1 text-[10px] font-normal text-slate-400"
      />
      <div className="mt-1.5 grid grid-cols-2 gap-x-1 gap-y-0.5 border-t border-white/10 pt-1.5 text-[10px] leading-tight">
        {classVolumeRows.map((row) => {
          const vol = resolveClassVolumeMl(lungMl, row.ml, row.burden);
          return (
            <div key={row.key} className="min-w-0 text-center">
              <div className={`truncate font-medium ${row.colorClass}`}>{row.label}</div>
              <div className="truncate font-semibold text-white">
                {vol != null
                  ? formatSegmentationVolume(displayUnit, {
                      volumeMl: vol,
                      burdenFraction: row.burden,
                    })
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
