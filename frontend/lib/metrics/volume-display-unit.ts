/** Practitioner preference for how segmentation volumes are shown. */

export type VolumeDisplayUnit = "mm" | "cm" | "ml" | "percent";

export const VOLUME_DISPLAY_UNITS: readonly VolumeDisplayUnit[] = [
  "mm",
  "cm",
  "ml",
  "percent",
] as const;

export const VOLUME_DISPLAY_LABELS: Record<VolumeDisplayUnit, string> = {
  mm: "mm³",
  cm: "cm³",
  ml: "ml",
  percent: "% (burden)",
};

/** Map API `unit_measurement` (and aliases) to a display unit. */
export function normalizeVolumeDisplayUnit(
  raw?: string | null,
): VolumeDisplayUnit {
  const v = (raw ?? "mm").toLowerCase().trim();
  if (v === "cm" || v === "cm3" || v === "cm³") return "cm";
  if (v === "ml") return "ml";
  if (v === "percent" || v === "pct" || v === "%") return "percent";
  return "mm";
}
