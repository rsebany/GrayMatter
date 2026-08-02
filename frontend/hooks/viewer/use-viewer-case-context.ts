import { useMemo } from "react";

import type { StudyListItem } from "@/api/domain";
import { formatAcqDate, shortStudyId } from "@/lib/studies/study-display";
import { usePatientsList } from "@/hooks/patients";
import { useStudiesList } from "@/hooks/studies";

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isPlaceholderName(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized === "unknown" ||
    normalized === "unknown patient" ||
    normalized === "patient-unknown" ||
    normalized === "anonymous" ||
    normalized === "anonymized" ||
    normalized === "anonymised"
  );
}

function resolvePatientDisplayName(
  preferredName: string | null | undefined,
  fallbackName: string | null | undefined,
  patientId: string,
): string | null {
  const primary = normalizeName(preferredName);
  const secondary = normalizeName(fallbackName);

  if (primary && !isPlaceholderName(primary) && primary !== patientId) return primary;
  if (primary && !isPlaceholderName(primary)) return primary;
  if (secondary && !isPlaceholderName(secondary)) return secondary;
  if (primary) return primary;
  if (secondary) return secondary;
  if (patientId) return patientId;
  return null;
}

export function formatViewerStudyLine(
  study: StudyListItem | undefined,
  studyId: string | null | undefined,
): string | null {
  if (study) {
    const parts: string[] = [];
    const modality = normalizeName(study.modality);
    if (modality) parts.push(modality);
    const when = formatAcqDate(study.acquisition_date);
    if (when) parts.push(when);
    parts.push(shortStudyId(study.study_id));
    return parts.join(" · ");
  }
  if (studyId) return shortStudyId(studyId);
  return null;
}

export type ViewerCaseContext = {
  patientName: string | null;
  studyLine: string | null;
};

export function useViewerCaseContext(
  studyId: string | null | undefined,
  patientId: string | null | undefined,
): ViewerCaseContext {
  const { data: studies } = useStudiesList();
  const { data: patients } = usePatientsList();

  return useMemo(() => {
    const study = studies?.find((s) => s.study_id === studyId);
    const resolvedPatientId = normalizeName(patientId) || study?.patient_id || "";
    const patient = patients?.find((p) => p.id === resolvedPatientId);

    const patientName = resolvedPatientId
      ? resolvePatientDisplayName(
          patient?.name,
          study?.patient_name,
          resolvedPatientId,
        )
      : study
        ? resolvePatientDisplayName(undefined, study.patient_name, study.patient_id)
        : null;

    const studyLine = formatViewerStudyLine(study, studyId ?? null);

    return { patientName, studyLine };
  }, [studies, patients, studyId, patientId]);
}
