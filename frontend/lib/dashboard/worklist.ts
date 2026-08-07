import type { StudyListItem } from "@/api/domain";
import { studyViewerQuery as buildStudyViewerQuery } from "@/lib/imaging";
import { formatSegmentationVolume } from "@/lib/metrics/format-segmentation-volume";
import type { RecentStudyRow } from "@/lib/dashboard/recent-studies";
import { formatStudyWhenLabel } from "@/lib/studies/study-display";
import {
  filterStudiesByPeriod,
  type WorklistPeriodDays,
} from "@/lib/dashboard/study-trend";

export type WorklistFilter = "all" | "active" | "done";

/** Dashboard worklist lesion volume unit (clinical convention). */
export const DASHBOARD_ILD_VOLUME_UNIT = "cm" as const;

export function formatIldVolumeCm3(
  volumeMm3: number,
  hasSegmentation: boolean,
): string {
  if (!hasSegmentation || volumeMm3 <= 0) return "—";
  return formatSegmentationVolume(DASHBOARD_ILD_VOLUME_UNIT, { volumeMm3 });
}

function recentStudyViewerQuery(study: RecentStudyRow): string {
  return buildStudyViewerQuery({ studyId: study.id, patientId: study.patientId });
}

export function isUrgentStudy(study: RecentStudyRow): boolean {
  const status = study.status.toLowerCase();
  return (
    status.includes("urgent") ||
    status.includes("critical") ||
    status.includes("stat")
  );
}

export function isStudyReadyForViewers(study: RecentStudyRow): boolean {
  const status = study.status.toLowerCase();
  return status.includes("complete") || (study.hasSegmentation ?? false);
}

export function getPrimaryReviewPath(
  study: RecentStudyRow,
  prefers3D: boolean,
  canOpen3d: boolean,
): string {
  if (prefers3D && canOpen3d) {
    return `/view3d?${recentStudyViewerQuery(study)}`;
  }
  return `/view2d?${recentStudyViewerQuery(study)}`;
}

export function applyWorklistFilter(
  list: RecentStudyRow[],
  filter: WorklistFilter,
): RecentStudyRow[] {
  if (filter === "all") return list;
  if (filter === "active") {
    return list.filter((s) => {
      if (isUrgentStudy(s)) return true;
      const status = s.status.toLowerCase();
      return status === "pending" || status === "processing";
    });
  }
  if (filter === "done") {
    return list.filter((s) => s.status.toLowerCase().includes("complete"));
  }
  return list;
}

export function filterStudiesForWorklist(
  studies: StudyListItem[],
  periodDays: WorklistPeriodDays,
  statusFilter: WorklistFilter,
): StudyListItem[] {
  const inPeriod = filterStudiesByPeriod(studies, periodDays);
  if (statusFilter === "all") return inPeriod;

  return inPeriod.filter((study) => {
    const status = study.status.toLowerCase();
    if (statusFilter === "done") {
      return status.includes("complete");
    }
    return status === "pending" || status === "processing";
  });
}

export function countNeedingAttention(studies: RecentStudyRow[]): number {
  return studies.filter((s) => {
    const status = s.status.toLowerCase();
    return status === "pending" || status === "processing" || isUrgentStudy(s);
  }).length;
}

export function buildWorklistSummary(
  studies: RecentStudyRow[],
  listLoading: boolean,
): string {
  if (listLoading) return "…";
  if (studies.length === 0) return "No recent studies yet.";
  const need = countNeedingAttention(studies);
  if (need > 0) return `${studies.length} recent · ${need} open`;
  return `${studies.length} recent`;
}

export { formatStudyWhenLabel };
