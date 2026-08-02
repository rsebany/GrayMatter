import {
  formatSegmentationVolume,
  formatSegmentationVolumeNumber,
} from "@/lib/metrics/format-segmentation-volume";

/** @deprecated Prefer `formatSegmentationVolume` with the user's display unit. */
export function formatVolumeMm3Number(mm3: number, maximumFractionDigits = 0): string {
  return formatSegmentationVolumeNumber("mm", {
    volumeMm3: mm3,
    maximumFractionDigits,
  });
}

/** Format a volume already expressed in mm³ (default display unit). */
export function formatVolumeMm3(mm3: number, maximumFractionDigits = 0): string {
  return formatSegmentationVolume("mm", {
    volumeMm3: mm3,
    maximumFractionDigits,
  });
}

/**
 * API lesion / lung fields (`*_volume_ml`, `lung_volume_ml`) are stored as ml
 * (= cm³); default display multiplies by 1000 for mm³.
 */
export function formatVolumeFromMlAsMm3(volumeMl: number, maximumFractionDigits = 0): string {
  return formatSegmentationVolume("mm", {
    volumeMl,
    maximumFractionDigits,
  });
}
