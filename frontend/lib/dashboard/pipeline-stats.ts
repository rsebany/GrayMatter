import type { DashboardMetrics } from "@/api/domain";

export type PipelineStats = {
  pendingCount: number;
  completedToday: number;
  processedCount: number;
  avgTurnaroundHours: number | null;
  pendingPct: number;
  processedPct: number;
};

export function derivePipelineStats(
  studiesCount: number,
  dashboardMetrics?: DashboardMetrics | null,
): PipelineStats {
  const pendingCount = dashboardMetrics?.pending_count ?? 0;
  const completedToday = dashboardMetrics?.completed_today ?? 0;
  const processedCount = Math.max(studiesCount - pendingCount, 0);
  const rawTurnaround = dashboardMetrics?.avg_turnaround_hours;
  const avgTurnaroundHours =
    typeof rawTurnaround === "number" && Number.isFinite(rawTurnaround)
      ? rawTurnaround
      : null;

  return {
    pendingCount,
    completedToday,
    processedCount,
    avgTurnaroundHours,
    pendingPct: studiesCount > 0 ? (pendingCount / studiesCount) * 100 : 0,
    processedPct: studiesCount > 0 ? (processedCount / studiesCount) * 100 : 0,
  };
}
