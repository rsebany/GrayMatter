import type { WorklistFilter } from "./types";
import { DASHBOARD_ILD_VOLUME_UNIT } from "@/lib/dashboard/worklist";

export { DASHBOARD_ILD_VOLUME_UNIT };

export const WORKLIST_FILTER_OPTIONS: ReadonlyArray<{
  id: WorklistFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "active", label: "Open" },
  { id: "done", label: "Done" },
] as const;
