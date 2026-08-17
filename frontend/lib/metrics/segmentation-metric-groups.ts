import type { StudyMetrics } from "@/api/domain";
import {
  formatSegmentationVolume,
  metricLabelWithUnit,
} from "@/lib/metrics/format-segmentation-volume";
import {
  leftHippocampusBurden,
  leftHippocampusMl,
  rightHippocampusBurden,
  rightHippocampusMl,
  hippocampusBurden,
  totalHippocampusMl,
} from "@/lib/metrics/hippocampus-metrics";
import {
  computeHemisphereHippocampusBarFillPercent,
  computeTotalHippocampusBarFillPercent,
} from "@/lib/metrics/hippocampus-volume-bar";
import type {
  MetricProgressGroup,
  MetricProgressItem,
} from "@/lib/metrics/metric-progress-types";
import {
  normalizeVolumeDisplayUnit,
  type VolumeDisplayUnit,
} from "@/lib/metrics/volume-display-unit";

export type { MetricProgressGroup, MetricProgressItem };

/** Hippocampus volume groups: total, left/right hemispheres. */
export function buildSegmentationMetricGroups(
  metrics: StudyMetrics | null | undefined,
  unit: VolumeDisplayUnit = "mm",
): MetricProgressGroup[] {
  if (!metrics) return [];

  const displayUnit = normalizeVolumeDisplayUnit(unit);
  const burden = hippocampusBurden(metrics);
  const totalMl = totalHippocampusMl(metrics);
  const leftMl = leftHippocampusMl(metrics);
  const rightMl = rightHippocampusMl(metrics);

  const volumes: MetricProgressItem[] = [
    {
      label: metricLabelWithUnit("Total hippocampus", displayUnit),
      val: formatSegmentationVolume(displayUnit, {
        volumeMm3: metrics.volume_total_mm3,
        volumeMl: totalMl,
        burdenFraction: burden,
      }),
      color: "bg-sky-500",
      progress: computeTotalHippocampusBarFillPercent(metrics.volume_total_mm3 ?? 0),
    },
  ];

  const perClass: Array<{
    name: string;
    ml?: number | null;
    burden?: number | null;
    color: string;
  }> = [
    {
      name: "Left hippocampus",
      ml: leftMl,
      burden: leftHippocampusBurden(metrics),
      color: "bg-emerald-500",
    },
    {
      name: "Right hippocampus",
      ml: rightMl,
      burden: rightHippocampusBurden(metrics),
      color: "bg-violet-500",
    },
  ];

  const foregroundMl = metrics.lung_volume_ml;
  const hemispheres: MetricProgressItem[] = [];
  for (const c of perClass) {
    if (c.ml == null && c.burden == null) continue;
    let volumeMl: number | null = c.ml ?? null;
    if (volumeMl == null && foregroundMl != null && foregroundMl > 0 && c.burden != null) {
      volumeMl = c.burden * foregroundMl;
    }
    if (volumeMl == null && c.burden === 0) volumeMl = 0;

    const burdenFrac =
      c.burden ??
      (foregroundMl != null && foregroundMl > 0 && volumeMl != null
        ? volumeMl / foregroundMl
        : 0);

    hemispheres.push({
      label: metricLabelWithUnit(c.name, displayUnit),
      val: formatSegmentationVolume(displayUnit, {
        volumeMl,
        burdenFraction: burdenFrac,
      }),
      color: c.color,
      progress: computeHemisphereHippocampusBarFillPercent(volumeMl ?? 0),
    });
  }

  const groups: MetricProgressGroup[] = [
    { title: "Hippocampus volumes", items: volumes },
  ];
  if (hemispheres.length > 0) {
    groups.push({ title: "Left / right", items: hemispheres });
  }

  return groups;
}
