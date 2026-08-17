import type { WorklistFilter } from "./types";
import { DASHBOARD_ILD_VOLUME_UNIT } from "@/lib/dashboard/worklist";
import type { WorklistPeriodDays } from "@/lib/dashboard/study-trend";

export { DASHBOARD_ILD_VOLUME_UNIT };

export const WORKLIST_FILTER_OPTIONS: ReadonlyArray<{
  id: WorklistFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "active", label: "Open" },
  { id: "done", label: "Done" },
] as const;

export const WORKLIST_PERIOD_OPTIONS: ReadonlyArray<{
  id: WorklistPeriodDays;
  label: string;
}> = [
  { id: "all", label: "All time" },
  { id: 7, label: "Last 7 days" },
  { id: 14, label: "Last 14 days" },
  { id: 20, label: "Last 20 days" },
  { id: 30, label: "Last 30 days" },
] as const;
