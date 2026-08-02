/**
 * Analytics types — dashboard aggregates.
 */

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardMetrics {
  mean_dice: number;
  studies_count: number;
  pending_count: number;
  completed_today: number;
  avg_turnaround_hours: number;
}

/** @deprecated Import from `./studies` or `@/api/domain` instead. */
export type { StudyMetrics } from "./studies";
