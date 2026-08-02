/**
 * Dashboard worklist — recent studies with filters, hippocampus volume (cm³), and viewer actions.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RecentStudyRow } from "@/lib/dashboard";

import { WORKLIST_FILTER_OPTIONS } from "./_shared/constants";
import type { CanFn, WorklistFilter } from "./_shared/types";
import {
  applyWorklistFilter,
  buildWorklistSummary,
} from "@/lib/dashboard/worklist";
import { WorklistStudyRow } from "./WorklistStudyRow";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecentStudiesSectionProps = {
  recentStudies: RecentStudyRow[];
  can: CanFn;
  defaultView?: string | null;
  listLoading?: boolean;
  /** Must match the slice used in `useRecentStudies(…, limit, …)` for copy accuracy. */
  worklistLimit?: number;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecentStudiesSection({
  recentStudies,
  can,
  defaultView,
  listLoading,
  worklistLimit = 5,
}: RecentStudiesSectionProps) {
  const [filterStatus, setFilterStatus] = useState<WorklistFilter>("all");

  if (!can("quantitative_metrics") && !can("manage_patients")) {
    return null;
  }

  const prefers3D = defaultView === "3d";
  const canOpen3d = can("explore_3d_xr") || can("view_shared_3d");
  const canManage = can("manage_patients");
  const filteredStudies = applyWorklistFilter(recentStudies, filterStatus);
  const worklistSummary = buildWorklistSummary(recentStudies, listLoading ?? false);

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">Worklist</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {worklistSummary}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-1.5">
          {WORKLIST_FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              variant={filterStatus === opt.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(opt.id)}
              className="h-8 shrink-0 text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-graymatter-border bg-graymatter-card shadow-sm">
        <div className="divide-y divide-graymatter-border">
          {listLoading ? (
            Array.from({ length: worklistLimit }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 sm:p-5"
              >
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-40 max-w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-56 max-w-full animate-pulse rounded bg-muted/80" />
                </div>
                <div className="hidden h-10 w-24 shrink-0 animate-pulse rounded-md bg-muted sm:block" />
              </div>
            ))
          ) : filteredStudies.length > 0 ? (
            filteredStudies.map((study) => (
              <WorklistStudyRow
                key={study.id}
                study={study}
                canManage={canManage}
                canOpen3d={canOpen3d}
                prefers3D={prefers3D}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/60" aria-hidden />
              <h3 className="mt-3 text-sm font-medium text-foreground">
                {recentStudies.length === 0 ? "Nothing here yet" : "No matches"}
              </h3>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {recentStudies.length === 0
                  ? "Upload or add a case above."
                  : "Change filter or see all studies."}
              </p>
              {recentStudies.length > 0 && (
                <Button
                  variant="link"
                  className="mt-2 h-auto p-0 text-sky-600"
                  onClick={() => setFilterStatus("all")}
                >
                  Show all in list
                </Button>
              )}
            </div>
          )}
        </div>

        {recentStudies.length > 0 &&
          (can("quantitative_metrics") || can("manage_patients")) && (
            <div className="border-t border-graymatter-border bg-graymatter-card-hover px-4 py-2.5 text-center text-xs text-muted-foreground">
              {can("quantitative_metrics") ? (
                <Link href="/studies" className="text-sky-600 hover:underline">
                  All studies
                  <ChevronRight className="ml-0.5 inline h-3 w-3" />
                </Link>
              ) : (
                <Link href="/patients" className="text-sky-600 hover:underline">
                  Patients
                  <ChevronRight className="ml-0.5 inline h-3 w-3" />
                </Link>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
