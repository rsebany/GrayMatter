"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUploadStudy } from "@/hooks/studies";
import { usePatientsList } from "@/hooks/patients";
import type { Patient } from "@/api/domain";
import { CaseSheetHeader } from "@/components/features/studies/case-sheet/CaseSheetHeader";
import { CaseSheetPatientStep } from "@/components/features/studies/case-sheet/CaseSheetPatientStep";
import { CaseSheetStudyStep } from "@/components/features/studies/case-sheet/CaseSheetStudyStep";

export type PatientStepData = {
  id: string;
  name: string;
  dob: string;
};

export type StudyStepData = {
  description: string;
  clinicalNotes: string;
  files: File[] | null;
  modality: string;
};

export type AddCasePayload = {
  patient: PatientStepData;
  study: StudyStepData;
};

type AddCaseSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (payload: AddCasePayload) => void;
};

const defaultPatient: PatientStepData = { id: "", name: "", dob: "" };
const defaultStudy: StudyStepData = {
  description: "",
  clinicalNotes: "",
  files: null,
  modality: "mri",
};

export function AddCaseSheet({ open, onOpenChange, onSubmit }: AddCaseSheetProps) {
  const router = useRouter();
  const { data: patients = [] } = usePatientsList();
  const [phase, setPhase] = useState<"form" | "success">("form");
  const [completedStudyId, setCompletedStudyId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [patient, setPatient] = useState<PatientStepData>(defaultPatient);
  const [selectedPatient, setSelectedPatient] = useState<Patient | undefined>();
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [study, setStudy] = useState<StudyStepData>(defaultStudy);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const {
    mutateAsync: uploadStudy,
    isPending: isUploading,
    error: uploadError,
    reset: resetMutation,
  } = useUploadStudy({
    onUploadProgress: (percent: number) => setUploadProgress(percent),
    onSuccess: (studyId: string) => {
      onSubmit?.({ patient, study });
      setCompletedStudyId(studyId);
      setPhase("success");
      resetMutation();
    },
  });

  const resetInternal = () => {
    setPhase("form");
    setCompletedStudyId(null);
    setStep(1);
    setPatient(defaultPatient);
    setSelectedPatient(undefined);
    setIsNewPatient(false);
    setStudy(defaultStudy);
    setUploadProgress(0);
    resetMutation();
  };

  const reset = () => {
    resetInternal();
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetInternal();
    onOpenChange(next);
  };

  const handleContinueToDashboard = () => {
    if (completedStudyId) {
      router.push(`/dashboard?studyId=${completedStudyId}`);
    }
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase === "success") return;

    if (step === 1) {
      if (isNewPatient) {
        if (!patient.name.trim()) return;
        setStep(2);
        return;
      }
      if (!patient.id || !patient.name) return;
      setStep(2);
      return;
    }

    if (!study.files?.length) return;

    setUploadProgress(0);

    try {
      const files = study.files ?? [];
      if (!files.length) return;
      await uploadStudy({
        patient: {
          id: patient.id || undefined,
          name: patient.name,
          dob: patient.dob || undefined,
        },
        files,
        description: study.description || undefined,
      });
    } catch {
      // Error surfaced via uploadError from mutation
    }
  };

  const canProceedStep1 = isNewPatient
    ? patient.name.trim().length > 2
    : patient.id.trim().length > 0 && patient.name.trim().length > 2;
  const hasDicom = Array.isArray(study.files) && study.files.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal>
      <DialogContent
        className={
          phase === "success"
            ? "flex flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
            : "flex w-full max-h-[min(90vh,880px)] flex-col gap-0 overflow-hidden border-l border-graymatter-border bg-graymatter-card p-0 shadow-2xl sm:max-w-lg"
        }
        showCloseButton={!isUploading}
        onPointerDownOutside={(e) => {
          if (isUploading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isUploading) e.preventDefault();
        }}
      >
        {phase === "success" ? (
          <div className="flex flex-col items-center px-5 py-8 text-center sm:px-8 sm:py-10">
            <CheckCircle2
              className="mb-4 h-16 w-16 text-emerald-500"
              aria-hidden
            />
            <DialogTitle className="text-xl">Intake complete</DialogTitle>
            <DialogDescription className="mt-2 max-w-sm text-balance">
              DICOM is uploaded. AI will run next—open the study from the dashboard
              or your worklist when it is ready.
            </DialogDescription>
            <Button
              type="button"
              className="mt-8 h-12 w-full max-w-xs rounded-2xl bg-sky-600 font-semibold hover:bg-sky-500"
              onClick={handleContinueToDashboard}
            >
              Continue to dashboard
            </Button>
          </div>
        ) : (
          <div className="flex max-h-[min(90vh,880px)] min-h-0 flex-col overflow-hidden">
            <div className="h-1 w-full shrink-0 bg-muted">
              <div
                className="h-full bg-sky-500 transition-all duration-500"
                style={{ width: step === 1 ? "50%" : "100%" }}
              />
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col">
              <DialogTitle className="sr-only">
                Add case — step {step} of 2
              </DialogTitle>

              {isUploading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 rounded-2xl bg-graymatter-card/95 backdrop-blur-sm">
                  <Loader2 className="h-12 w-12 animate-spin text-sky-500" />
                  <div className="w-full max-w-[240px] space-y-2">
                    <p className="text-center text-sm font-medium text-foreground">
                      Uploading study…
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-sky-500 transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground">
                      {uploadProgress}%
                    </p>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
                  {uploadError && (
                    <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                      {(() => {
                        if (uploadError instanceof Error) {
                          const anyErr = uploadError as {
                            response?: { data?: { detail?: unknown } };
                            message: string;
                          };
                          const detail = anyErr.response?.data?.detail;

                          if (typeof detail === "string") {
                            return detail;
                          }
                          if (Array.isArray(detail)) {
                            const msgs = detail
                              .map((e) => {
                                if (e && typeof e === "object") {
                                  return e.msg ?? e.message ?? JSON.stringify(e);
                                }
                                return String(e);
                              })
                              .join("; ");
                            return msgs || anyErr.message;
                          }
                          if (detail && typeof detail === "object") {
                            return JSON.stringify(detail);
                          }
                          return anyErr.message;
                        }

                        return String(uploadError);
                      })()}
                    </div>
                  )}

                  <CaseSheetHeader step={step} />

                  <div className="flex flex-col gap-6 sm:gap-8">
                    {step === 1 && (
                      <CaseSheetPatientStep
                        isNewPatient={isNewPatient}
                        patient={patient}
                        selectedPatient={selectedPatient}
                        patients={patients}
                        setIsNewPatient={setIsNewPatient}
                        setPatient={setPatient}
                        setSelectedPatient={setSelectedPatient}
                      />
                    )}

                    {step === 2 && (
                      <CaseSheetStudyStep
                        study={study}
                        hasDicom={hasDicom}
                        setStudy={setStudy}
                      />
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-graymatter-border bg-graymatter-card px-4 py-4 sm:flex-row sm:px-8 sm:py-5">
                  {step === 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="rounded-xl text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  )}

                  <Button
                    type="submit"
                    disabled={
                      isUploading || (step === 1 ? !canProceedStep1 : !hasDicom)
                    }
                    className={`h-12 w-full rounded-2xl font-bold transition-all disabled:opacity-30 sm:h-14 sm:flex-1 ${
                      step === 2
                        ? "bg-emerald-600 shadow-lg shadow-black/20 hover:bg-emerald-500"
                        : "bg-sky-600 shadow-lg shadow-black/20 hover:bg-sky-500"
                    } text-white`}
                  >
                    {step === 1 ? (
                      <>
                        Continue to imaging{" "}
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </>
                    ) : isUploading ? (
                      <>Uploading… {uploadProgress}%</>
                    ) : (
                      <>Upload & run AI</>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
