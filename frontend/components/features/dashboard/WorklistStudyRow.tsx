/**
 * Single row in the dashboard worklist.
 */
"use client";

import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

import type { RecentStudyRow } from "@/lib/dashboard";

import {
  formatIldVolumeCm3,
  formatStudyWhenLabel,
  getPrimaryReviewPath,
  isStudyReadyForViewers,
} from "@/lib/dashboard/worklist";
import { shortStudyId } from "@/lib/studies/study-display";
import { getPriorityLevel } from "./_shared/study-priority";
import { StudyActionsMenu } from "@/components/features/studies/StudyActionsMenu";

export type WorklistStudyRowProps = {
  study: RecentStudyRow;
  canManage: boolean;
  canOpen3d: boolean;
  prefers3D: boolean;
};

export function WorklistStudyRow({
  study,
  canManage,
  canOpen3d,
  prefers3D,
}: WorklistStudyRowProps) {
  const router = useRouter();

  const priority = getPriorityLevel(
    study.status,
    study.hasSegmentation ?? false,
  );
  const whenLabel = formatStudyWhenLabel(study.acquisitionDate);
  const ready = isStudyReadyForViewers(study);
  const primaryPath =
    canManage && ready
      ? getPrimaryReviewPath(study, prefers3D, canOpen3d)
      : null;

  const activateRow = () => {
    if (primaryPath) router.push(primaryPath);
  };

  const onRowKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activateRow();
    }
  };

  const rowInteractive = Boolean(canManage && primaryPath);

  return (
    <div
      className={
        rowInteractive
          ? "group flex cursor-pointer flex-col gap-3 p-4 transition-all hover:bg-graymatter-card-hover focus-within:bg-graymatter-card-hover sm:flex-row sm:items-center sm:justify-between sm:p-5"
          : "group flex flex-col gap-3 p-4 transition-all hover:bg-graymatter-card-hover sm:flex-row sm:items-center sm:justify-between sm:p-5"
      }
      onClick={rowInteractive ? activateRow : undefined}
      onKeyDown={rowInteractive ? onRowKeyDown : undefined}
      role={rowInteractive ? "link" : undefined}
      tabIndex={rowInteractive ? 0 : undefined}
      aria-label={
        rowInteractive
          ? `Open case ${study.patientName}, primary review`
          : undefined
      }
    >
      <div className="flex min-w-0 w-full flex-1 items-start gap-3 sm:items-center sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/20 to-sky-600/10 text-sm font-bold text-sky-600 shadow-sm">
          {study.patientName
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 truncate text-base font-semibold text-foreground">
              {study.patientName}
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${priority.color}`}
            >
              {priority.icon}
              {priority.label}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span
              className="font-mono text-[11px] tabular-nums"
              title={study.id}
            >
              Study {shortStudyId(study.id)}
            </span>
            <span className="text-border">·</span>
            <span className="uppercase">{study.type}</span>
            <span className="text-border">·</span>
            <span
              className="flex min-w-0 items-center gap-1 tabular-nums"
              title={study.acquisitionDate ?? undefined}
            >
              <Clock className="h-3 w-3 shrink-0" />
              {whenLabel}
            </span>
          </div>
        </div>

        <div className="shrink-0 sm:text-right">
          <div className="text-xs font-medium text-muted-foreground">
            Hippocampus volume
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-foreground sm:text-lg">
            {formatIldVolumeCm3(
              study.volumeTotalMm3,
              study.hasSegmentation ?? false,
            )}
          </div>
        </div>
      </div>

      <div
        className="flex w-full shrink-0 sm:ml-6 sm:w-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {canManage && (
          <StudyActionsMenu
            studyId={study.id}
            patientId={study.patientId}
            canOpen3d={canOpen3d}
            ready={ready}
          />
        )}
      </div>
    </div>
  );
}
