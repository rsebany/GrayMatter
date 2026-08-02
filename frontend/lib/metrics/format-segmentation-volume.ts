import {
  normalizeVolumeDisplayUnit,
  type VolumeDisplayUnit,
} from "@/lib/metrics/volume-display-unit";

export type SegmentationVolumeInput = {
  /** Total ILD or similar, stored as mm³ in API (`volume_total_mm3`). */
  volumeMm3?: number | null;
  /** Per-class / lung volumes stored as ml (= cm³ numerically). */
  volumeMl?: number | null;
  /** Fraction of lung volume (0–1), used for percent display. */
  burdenFraction?: number | null;
  maximumFractionDigits?: number;
};

function formatNumber(n: number, maximumFractionDigits: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function resolveVolumeMl(input: SegmentationVolumeInput): number | null {
  if (input.volumeMl != null && Number.isFinite(input.volumeMl)) {
    return input.volumeMl;
  }
  if (input.volumeMm3 != null && Number.isFinite(input.volumeMm3)) {
    return input.volumeMm3 / 1000;
  }
  return null;
}

/** Numeric part only (for split value + unit typography). */
export function formatSegmentationVolumeNumber(
  unit: VolumeDisplayUnit,
  input: SegmentationVolumeInput,
): string {
  const digits = input.maximumFractionDigits ?? (unit === "percent" ? 2 : 0);

  if (unit === "percent") {
    const burden = input.burdenFraction;
    if (burden == null || !Number.isFinite(burden)) return "—";
    return formatNumber(burden * 100, digits);
  }

  const ml = resolveVolumeMl(input);
  if (ml == null) return "—";

  if (unit === "mm") {
    return formatNumber(ml * 1000, digits);
  }
  if (unit === "cm" || unit === "ml") {
    return formatNumber(ml, unit === "ml" ? Math.max(digits, 2) : digits);
  }

  return "—";
}

export function formatSegmentationVolumeUnitLabel(unit: VolumeDisplayUnit): string {
  switch (unit) {
    case "percent":
      return "%";
    case "mm":
      return "mm³";
    case "cm":
      return "cm³";
    case "ml":
      return "ml";
    default:
      return "mm³";
  }
}

/** Value and unit as a single string, e.g. ``1,234 mm³`` or ``12.5 %``. */
export function formatSegmentationVolume(
  unit: VolumeDisplayUnit,
  input: SegmentationVolumeInput,
): string {
  const value = formatSegmentationVolumeNumber(unit, input);
  if (value === "—") return "—";
  return `${value} ${formatSegmentationVolumeUnitLabel(unit)}`;
}

/** Label suffix for metric rows, e.g. ``Left hippocampus (mm³)``. */
export function metricLabelWithUnit(baseLabel: string, unit: VolumeDisplayUnit): string {
  if (unit === "percent") {
    return `${baseLabel} (%)`;
  }
  return `${baseLabel} (${formatSegmentationVolumeUnitLabel(unit)})`;
}

export { normalizeVolumeDisplayUnit };
