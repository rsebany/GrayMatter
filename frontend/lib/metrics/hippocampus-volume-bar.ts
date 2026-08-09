/** Upper reference values for adult hippocampal volume bars. */
export const HIPPOCAMPUS_TOTAL_REFERENCE_MAX_CM3 = 10;
export const HIPPOCAMPUS_HEMISPHERE_REFERENCE_MAX_CM3 = 5;

function computeFillPercent(volumeCm3: number, referenceMaxCm3: number): number {
  const normalizedVolume = Math.max(0, volumeCm3);
  if (normalizedVolume === 0) return 0;
  return Math.min(100, (normalizedVolume / referenceMaxCm3) * 100);
}

/** Fill width for total hippocampal volume supplied in mm³. */
export function computeTotalHippocampusBarFillPercent(volumeMm3: number): number {
  return computeFillPercent(
    volumeMm3 / 1000,
    HIPPOCAMPUS_TOTAL_REFERENCE_MAX_CM3,
  );
}

/** Fill width for one hippocampal hemisphere supplied in ml (= cm³). */
export function computeHemisphereHippocampusBarFillPercent(volumeMl: number): number {
  return computeFillPercent(
    volumeMl,
    HIPPOCAMPUS_HEMISPHERE_REFERENCE_MAX_CM3,
  );
}
