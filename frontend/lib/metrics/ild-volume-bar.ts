/**
 * Fixed cm³ reference for ILD volume progress bars.
 * Bars use this scale instead of cohort max so sparse values (e.g. 150 cm³) stay readable.
 */
export const ILD_BAR_REFERENCE_MAX_CM3 = 500;

/** Fill width 0–100 for a horizontal ILD volume bar. */
export function computeIldBarFillPercent(volumeMm3: number): number {
  const cm3 = Math.max(0, volumeMm3) / 1000;
  if (cm3 <= 0) return 0;
  return Math.min(100, (cm3 / ILD_BAR_REFERENCE_MAX_CM3) * 100);
}

/** Same scale as {@link computeIldBarFillPercent} for API ml (= cm³) fields. */
export function computeIldBarFillPercentFromMl(volumeMl: number): number {
  return computeIldBarFillPercent(Math.max(0, volumeMl) * 1000);
}
