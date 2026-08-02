import React, { useState } from "react";
import { AlertCircle, Calendar, Database, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading";
import { StudyStatusBadge } from "@/components/features/studies/StudyStatusBadge";
import { StudyHippocampusBar } from "@/components/features/studies/StudyHippocampusBar";
import { StudyActionsMenu } from "@/components/features/studies/StudyActionsMenu";

type StudyStatus = "Processing" | "Pending" | "Completed";

type Study = {
  study_id: string;
  study_instance_uid?: string;
  patient_id: string;
  patient_name: string;
  acquisition_date?: string | null;
  status: StudyStatus;
  volume_total_mm3: number;
  ild_fraction?: number;
  ild_burden?: number | null;
};

interface StudiesTableSectionProps {
  studies: Study[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onDeleteStudy?: (studyId: string) => Promise<void>;
  isDeletingStudy?: boolean;
}

export function StudiesTableSection({
  studies,
  isLoading,
  isError,
  error,
  onDeleteStudy,
  isDeletingStudy = false,
}: StudiesTableSectionProps) {
  const [deletingStudyId, setDeletingStudyId] = useState<string | null>(null);

  const handleDeleteStudy = async (studyId: string) => {
    if (!onDeleteStudy) return;
    const ok = window.confirm(
      "Delete this study? This will remove analysis outputs and stored study files.",
    );
    if (!ok) return;
    try {
      setDeletingStudyId(studyId);
      await onDeleteStudy(studyId);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to delete study.";
      window.alert(message);
    } finally {
      setDeletingStudyId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-graymatter-border bg-graymatter-card shadow-xl">
      <div className="flex flex-col gap-2 border-b border-graymatter-border bg-graymatter-card-hover px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-sky-500" />
          <span className="text-sm font-medium text-foreground">
            Imaging Archive
          </span>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Study UID..."
            className="h-10 w-full rounded-lg border border-border bg-background px-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-sky-500 focus:outline-none sm:w-auto"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        {isLoading ? (
          <LoadingState
            label="Loading studies..."
            className="py-16"
            iconClassName="h-5 w-5"
          />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <p className="text-sm">Failed to load studies.</p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : (
          <table className="min-w-[920px] w-full border-collapse text-left">
            <thead className="bg-graymatter-card-hover text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold sm:px-6 sm:py-4">Study Details</th>
                <th className="px-3 py-3 font-semibold sm:px-6 sm:py-4">AI Status</th>
                <th className="px-3 py-3 font-semibold sm:px-6 sm:py-4">Hippocampus Volume</th>
                <th className="px-3 py-3 font-semibold text-right sm:px-6 sm:py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graymatter-border">
              {studies.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-10 text-center text-sm text-muted-foreground sm:px-6 sm:py-12"
                  >
                    No studies yet. Upload DICOM via Patient Registry or Add
                    Case.
                  </td>
                </tr>
              ) : (
                studies.map((study) => {
                  const ready = study.status === "Completed";
                  return (
                    <tr
                      key={study.study_id}
                      className="group transition-colors hover:bg-graymatter-card-hover"
                    >
                      <td className="px-3 py-3 sm:px-6 sm:py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">
                            {study.patient_name}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono text-sky-500">
                              {study.study_id}
                            </span>
                            <span>•</span>
                            <Calendar className="h-3 w-3" />
                            <span>{study.acquisition_date || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-4">
                        <StudyStatusBadge status={study.status} />
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-4">
                        <StudyHippocampusBar
                          volumeTotalMm3={study.volume_total_mm3}
                          isCompleted={ready}
                        />
                      </td>
                      <td className="px-3 py-3 text-right sm:px-6 sm:py-4">
                        <div className="flex flex-wrap justify-end gap-1.5 sm:gap-2">
                          <StudyActionsMenu
                            studyId={study.study_id}
                            patientId={study.patient_id}
                            ready={ready}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 gap-2 rounded-lg border border-rose-500/30 text-xs text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                            onClick={() => handleDeleteStudy(study.study_id)}
                            disabled={
                              !onDeleteStudy ||
                              isDeletingStudy ||
                              deletingStudyId === study.study_id
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deletingStudyId === study.study_id
                              ? "Deleting..."
                              : "Delete"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
