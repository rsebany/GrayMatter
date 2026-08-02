"use client";

import type { ReactNode } from "react";
import { User } from "lucide-react";
import type { Patient } from "@/api/domain";
import { cn } from "@/lib/utils";

type Props = {
  isNewPatient: boolean;
  newPatientName: string;
  selectedPatient?: Patient | null;
  /** Shown when non-empty (e.g. study notes from step 1). */
  studyDescription?: string;
  /** Trailing controls (Back, Edit, etc.). */
  actions?: ReactNode;
  className?: string;
};

export function UploadPatientSummaryCard({
  isNewPatient,
  newPatientName,
  selectedPatient,
  studyDescription,
  actions,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-500">
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Patient
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {isNewPatient ? newPatientName.trim() || "—" : selectedPatient?.name || "—"}
          </p>
          {selectedPatient && (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {selectedPatient.id}
            </p>
          )}
          {studyDescription?.trim() ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{studyDescription}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
