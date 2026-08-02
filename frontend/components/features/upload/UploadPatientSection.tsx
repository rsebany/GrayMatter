import { useRouter } from "next/navigation";
import {
  UserPlus,
  UserRoundSearch,
  Calendar,
  Dna,
  Fingerprint,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PatientCombobox } from "@/components/features/patients/PatientComboBox";
import { StudyLabelField } from "@/components/features/upload/StudyLabelField";
import type { Patient } from "@/api/domain";
import { cn } from "@/lib/utils";

type PatientStudySummary = {
  id: string;
  description: string;
  created_at: string;
  modality?: string;
};

type UploadPatientSectionProps = {
  isNewPatient: boolean;
  existingPatients: Patient[];
  patientId: string;
  selectedPatient?: Patient;
  newPatientName: string;
  newPatientDob: string;
  studyDescription: string;
  studiesForSelectedPatient: PatientStudySummary[];
  /** True while the full patient record (including studies) is being fetched. */
  priorStudiesLoading?: boolean;
  setIsNewPatient: (value: boolean) => void;
  setPatientId: (id: string) => void;
  setSelectedPatient: (p: Patient | undefined) => void;
  setNewPatientName: (name: string) => void;
  setNewPatientDob: (dob: string) => void;
  setStudyDescription: (desc: string) => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-border/80 bg-background/60 px-3.5 text-sm text-foreground shadow-sm outline-none transition-[border,box-shadow] focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20";

export function UploadPatientSection({
  isNewPatient,
  existingPatients,
  patientId,
  selectedPatient,
  newPatientName,
  newPatientDob,
  studyDescription,
  studiesForSelectedPatient,
  priorStudiesLoading = false,
  setIsNewPatient,
  setPatientId,
  setSelectedPatient,
  setNewPatientName,
  setNewPatientDob,
  setStudyDescription,
}: UploadPatientSectionProps) {
  const router = useRouter();

  return (
    <div className="group relative rounded-2xl border border-graymatter-border bg-graymatter-card shadow-sm">
      {/* Clipped only here so the patient combobox dropdown and long names are not cut off the card. */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_0%_0%,rgba(14,165,233,0.09),transparent_50%)]" />
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-500/5 blur-2xl" />
      </div>

      <div className="relative border-b border-border/50 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2.5">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/15 text-[10px] font-bold text-sky-400"
                aria-hidden
              >
                1
              </span>
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-500">
                <Stethoscope className="h-3.5 w-3.5" aria-hidden />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Patient identification
              </h2>
            </div>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground sm:ml-12 sm:mt-0.5">
              Pick or create a patient, then optionally label this study.
            </p>
          </div>

          <div className="shrink-0 self-start sm:pl-2">
            <div
              className="inline-flex items-center gap-0.5 rounded-full border border-border/80 bg-muted/30 p-1"
              role="group"
              aria-label="Patient source"
            >
              <button
                type="button"
                onClick={() => setIsNewPatient(false)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                  !isNewPatient
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <UserRoundSearch className="h-3.5 w-3.5 opacity-80" />
                From registry
              </button>
              <button
                type="button"
                onClick={() => setIsNewPatient(true)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                  isNewPatient
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <UserPlus className="h-3.5 w-3.5 opacity-80" />
                New patient
              </button>
            </div>
            <div className="mt-1.5 flex justify-end sm:justify-end">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-[11px] text-muted-foreground"
                onClick={() => router.push("/patients")}
              >
                Open full registry
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative space-y-6 px-5 py-5 sm:px-6 sm:py-6">
        <div
          className="min-w-0 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-6"
          onKeyDownCapture={(e) => e.stopPropagation()}
        >
          {isNewPatient ? (
            <>
              <div className="sm:col-span-2">
                <label
                  className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  htmlFor="upload-patient-name"
                >
                  <Dna className="h-3.5 w-3.5 text-sky-500/80" />
                  Full name
                  <span className="text-destructive" aria-label="required">
                    *
                  </span>
                </label>
                <input
                  id="upload-patient-name"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Jane M. Public"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  htmlFor="upload-patient-dob"
                >
                  <Calendar className="h-3.5 w-3.5 text-sky-500/80" />
                  Date of birth
                </label>
                <input
                  id="upload-patient-dob"
                  type="date"
                  value={newPatientDob}
                  onChange={(e) => setNewPatientDob(e.target.value)}
                  className={cn(fieldClass, "font-sans [color-scheme:dark]")}
                />
              </div>
              <div className="min-w-0">
                <StudyLabelField
                  id="upload-study-ctx"
                  value={studyDescription}
                  onChange={setStudyDescription}
                  placeholder="e.g. Baseline pre-trial HRCT"
                />
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0 sm:col-span-2">
                <label
                  className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  htmlFor="upload-patient-combo"
                >
                  Find patient
                  <span className="text-destructive" aria-label="required">
                    {" "}
                    *
                  </span>
                </label>
                <div id="upload-patient-combo" className="min-w-0 w-full max-w-full">
                  <PatientCombobox
                    key={patientId || "no-patient"}
                    patients={existingPatients}
                    value={patientId}
                    onChange={(id, patient) => {
                      setPatientId(id);
                      setSelectedPatient(patient);
                    }}
                    placeholder="Name, ID, or MRN…"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground/90">
                  Search the registry. Required to continue.
                </p>
              </div>
              {selectedPatient && (
                <div>
                  <label
                    className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                    htmlFor="medical-id-readonly"
                  >
                    <Fingerprint className="h-3.5 w-3.5 text-emerald-500/80" />
                    Medical ID
                  </label>
                  <div
                    id="medical-id-readonly"
                    className="flex h-11 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 font-mono text-sm text-foreground/90"
                  >
                    {selectedPatient.id}
                  </div>
                </div>
              )}
              {selectedPatient && (
                <div className="min-w-0">
                  <StudyLabelField
                    id="upload-study-ctx-reg"
                    value={studyDescription}
                    onChange={setStudyDescription}
                    placeholder="e.g. Post-biopsy follow-up"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {patientId && !isNewPatient && (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-background/50 to-muted/20">
            <div className="border-b border-border/40 bg-muted/20 px-3 py-2">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-foreground/60" />
                Prior studies on file
              </span>
            </div>
            <div className="p-3">
              {priorStudiesLoading ? (
                <p className="text-center text-xs text-muted-foreground">
                  Loading study history…
                </p>
              ) : studiesForSelectedPatient.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">
                  No previous studies in this app for this patient.
                </p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1 text-xs">
                  {studiesForSelectedPatient.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/30 bg-card/50 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-medium leading-snug text-foreground">
                          {s.description}
                        </span>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {s.modality && (
                            <span className="font-medium uppercase tracking-wide">
                              {s.modality}
                              {" · "}
                            </span>
                          )}
                          <span className="font-mono text-muted-foreground/85">
                            {s.id}
                          </span>
                        </p>
                      </div>
                      <time
                        className="shrink-0 self-start tabular-nums text-[10px] text-muted-foreground"
                        dateTime={s.created_at}
                      >
                        {new Date(s.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
