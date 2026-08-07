/**
 * Dashboard sidebar — primary CTA and worklist filters.
 */
"use client";

import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorklistPeriodDays } from "@/lib/dashboard/study-trend";

import type { WorklistFilter } from "./_shared/types";
import { DashboardWorklistFilter } from "./DashboardWorklistFilter";

export type DashboardQuickActionsProps = {
  showNewCase: boolean;
  showWorklistFilter: boolean;
  onStartAnalysis: () => void;
  periodDays: WorklistPeriodDays;
  statusFilter: WorklistFilter;
  onPeriodChange: (days: WorklistPeriodDays) => void;
  onStatusChange: (status: WorklistFilter) => void;
};

export function DashboardQuickActions({
  showNewCase,
  showWorklistFilter,
  onStartAnalysis,
  periodDays,
  statusFilter,
  onPeriodChange,
  onStatusChange,
}: DashboardQuickActionsProps) {
  if (!showNewCase && !showWorklistFilter) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-graymatter-border bg-graymatter-card p-4">
      {showNewCase && (
        <Button
          onClick={onStartAnalysis}
          className="w-full bg-sky-600 hover:bg-sky-500"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          New study
        </Button>
      )}
      {showWorklistFilter && (
        <DashboardWorklistFilter
          periodDays={periodDays}
          statusFilter={statusFilter}
          onPeriodChange={onPeriodChange}
          onStatusChange={onStatusChange}
        />
      )}
    </div>
  );
}
