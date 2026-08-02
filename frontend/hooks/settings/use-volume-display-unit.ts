"use client";

import { useSettings } from "@/hooks/settings/use-settings";
import {
  normalizeVolumeDisplayUnit,
  type VolumeDisplayUnit,
} from "@/lib/metrics/volume-display-unit";

/** Current practitioner's preferred segmentation volume unit. */
export function useVolumeDisplayUnit(): VolumeDisplayUnit {
  const { data: settings } = useSettings();
  return normalizeVolumeDisplayUnit(settings?.unit_measurement);
}
