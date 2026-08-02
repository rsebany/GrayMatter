/** Read hippocampus volumes/burdens with legacy API field fallbacks (internal only). */

type HippocampusMetricSource = {
  left_hippocampus_ml?: number | null;
  right_hippocampus_ml?: number | null;
  hippocampus_volume_ml?: number | null;
  total_ild_volume_ml?: number | null;
  /** @deprecated API alias for left hippocampus volume */
  ggo_volume_ml?: number | null;
  /** @deprecated API alias for right hippocampus volume */
  reticulation_volume_ml?: number | null;
  /** @deprecated API alias for left hippocampus burden */
  ggo_burden?: number | null;
  /** @deprecated API alias for right hippocampus burden */
  reticulation_burden?: number | null;
  ild_burden?: number | null;
  ild_fraction?: number | null;
};

export function leftHippocampusMl(
  metrics: HippocampusMetricSource,
): number | null | undefined {
  return metrics.left_hippocampus_ml ?? metrics.ggo_volume_ml;
}

export function rightHippocampusMl(
  metrics: HippocampusMetricSource,
): number | null | undefined {
  return metrics.right_hippocampus_ml ?? metrics.reticulation_volume_ml;
}

export function totalHippocampusMl(
  metrics: HippocampusMetricSource,
): number | null | undefined {
  return (
    metrics.hippocampus_volume_ml ??
    metrics.total_ild_volume_ml ??
    undefined
  );
}

export function leftHippocampusBurden(
  metrics: HippocampusMetricSource,
): number | null | undefined {
  return metrics.ggo_burden;
}

export function rightHippocampusBurden(
  metrics: HippocampusMetricSource,
): number | null | undefined {
  return metrics.reticulation_burden;
}

export function hippocampusBurden(
  metrics: HippocampusMetricSource,
): number | null | undefined {
  return metrics.ild_burden ?? metrics.ild_fraction;
}
