import type { Patient, StudyListItem } from "@/api/domain";

/** Row shape consumed by `RecentStudiesSection` on the dashboard. */
export type RecentStudyRow = {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  status: StudyListItem["status"];
  volumeTotalMm3: number;
  ildFraction: number;
  acquisitionDate?: string;
  hasSegmentation: boolean;
};

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

function resolvePatientName(
  preferredName: string | null | undefined,
  fallbackName: string | null | undefined,
  patientId: string,
): string {
  const primary = normalizeName(preferredName);
  const secondary = normalizeName(fallbackName);

  // Prefer the patient registry list (authoritative when the user edits display names).
  // Fall back to the study row's patient_name from the API when the patient is not in the list slice.
  if (primary && !isPlaceholderName(primary) && primary !== patientId) return primary;
  if (primary && !isPlaceholderName(primary)) return primary;
  if (secondary && !isPlaceholderName(secondary)) return secondary;
  if (primary) return primary;
  if (secondary) return secondary;
  return patientId;
}

export function buildRecentStudyRows(
  patients: Patient[],
  limit: number,
  studies: StudyListItem[],
): RecentStudyRow[] {
  const patientList = Array.isArray(patients) ? patients : [];
  const studyList = Array.isArray(studies) ? studies : [];

  const sorted = [...studyList].sort((a, b) => {
    const da = a.acquisition_date ? Date.parse(a.acquisition_date) : 0;
    const db = b.acquisition_date ? Date.parse(b.acquisition_date) : 0;
    return db - da;
  });

  return sorted.slice(0, limit).map((s) => {
    const patient = patientList.find((p) => p.id === s.patient_id);
    const fullName = resolvePatientName(patient?.name, s.patient_name, s.patient_id);

    return {
      id: s.study_id,
      patientId: s.patient_id,
      patientName: fullName,
      type: s.modality ?? "MRI",
      status: s.status,
      volumeTotalMm3: s.volume_total_mm3,
      ildFraction: s.ild_fraction,
      acquisitionDate:
        s.acquisition_date === null ? undefined : s.acquisition_date,
      hasSegmentation: s.status === "Completed" || s.ild_fraction > 0,
    };
  });
}
