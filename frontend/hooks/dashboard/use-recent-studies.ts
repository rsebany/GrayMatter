import { useMemo } from "react";
import type { Patient, StudyListItem } from "@/api/domain";
import { buildRecentStudyRows } from "@/lib/dashboard";

export function useRecentStudies(
  patients: Patient[],
  limit: number,
  studies?: StudyListItem[],
) {
  return useMemo(() => {
    const list = studies ?? [];
    return buildRecentStudyRows(patients, limit, list);
  }, [patients, studies, limit]);
}
