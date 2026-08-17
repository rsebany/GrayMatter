import { CheckCircle2, Clock3 } from "lucide-react";

import type { Patient, Study } from "@/api/domain";

type PatientHeaderProps = {
  patient: Patient;
  study: Study | null;
};

function dateOnly(value: string | undefined): string {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

export function PatientHeader({ patient, study }: PatientHeaderProps) {
  const inferenceComplete = Boolean(study?.segmentation);

  return (
    <header className="flex min-h-14 items-start justify-between gap-6 border-b border-[var(--border)] pb-3">
      <div>
        <h1 className="text-xl font-medium text-[var(--text-primary)]">{patient.name}</h1>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
          <span>DOB: {patient.dateOfBirth || "Not provided"}</span>
          <span aria-hidden="true">|</span>
          <span>
            ID: <strong className="font-medium text-[var(--registry-primary)]">{patient.id}</strong>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5 text-[10px] text-[var(--text-secondary)]">
        <span>Study Date: {dateOnly(study?.created_at)}</span>
        <span>Modality: {study?.modality?.toUpperCase() || "—"}</span>
        <span>Accession: {study?.id || "—"}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
            inferenceComplete
              ? "bg-[var(--registry-teal-soft)] text-[var(--text-success)]"
              : "bg-[var(--registry-warning-soft)] text-[var(--text-warning)]"
          }`}
        >
          {inferenceComplete ? (
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Clock3 className="h-3 w-3" aria-hidden="true" />
          )}
          {inferenceComplete ? "Inference complete" : "Inference pending"}
        </span>
      </div>
    </header>
  );
}
