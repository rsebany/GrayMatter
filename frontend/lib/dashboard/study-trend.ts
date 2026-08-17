import type { StudyListItem } from "@/api/domain";

export type WorklistPeriodDays = "all" | 7 | 14 | 20 | 30;

export function studyTimestamp(study: StudyListItem): number {
  const raw = study.acquisition_date;
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function filterStudiesByPeriod(
  studies: StudyListItem[],
  periodDays: WorklistPeriodDays,
): StudyListItem[] {
  if (periodDays === "all") return studies;

  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  return studies.filter((study) => {
    const ts = studyTimestamp(study);
    return ts === 0 || ts >= cutoff;
  });
}

export type StudyTrendSeries = {
  points: number[];
  percentChange: number | null;
  periodDays: WorklistPeriodDays;
};

/** Daily study counts over `periodDays`, plus % change vs the prior equal window. */
export function buildStudyTrendSeries(
  studies: StudyListItem[],
  periodDays: WorklistPeriodDays,
): StudyTrendSeries {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (periodDays === "all") {
    const timestamps = studies
      .map(studyTimestamp)
      .filter((timestamp) => timestamp > 0)
      .sort((a, b) => a - b);
    const points = Array.from({ length: 30 }, () => 0);

    if (timestamps.length > 0) {
      const start = timestamps[0];
      const span = Math.max(now - start, dayMs);
      for (const timestamp of timestamps) {
        const index = Math.min(
          points.length - 1,
          Math.max(0, Math.floor(((timestamp - start) / span) * points.length)),
        );
        points[index] += 1;
      }
    }

    return { points, percentChange: null, periodDays };
  }

  const periodStart = now - periodDays * dayMs;
  const previousStart = periodStart - periodDays * dayMs;

  const points = Array.from({ length: periodDays }, () => 0);
  let currentWindow = 0;
  let previousWindow = 0;

  for (const study of studies) {
    const ts = studyTimestamp(study);
    if (ts === 0) continue;

    if (ts >= periodStart) {
      currentWindow += 1;
      const dayIndex = Math.min(
        periodDays - 1,
        Math.max(0, Math.floor((ts - periodStart) / dayMs)),
      );
      points[dayIndex] += 1;
    } else if (ts >= previousStart && ts < periodStart) {
      previousWindow += 1;
    }
  }

  let percentChange: number | null = null;
  if (previousWindow > 0) {
    percentChange = ((currentWindow - previousWindow) / previousWindow) * 100;
  } else if (currentWindow > 0) {
    percentChange = 100;
  }

  return { points, percentChange, periodDays };
}
