/**
 * Dashboard sidebar — primary CTA to start a new study.
 */
"use client";

import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

export type DashboardQuickActionsProps = {
  showNewCase: boolean;
  onStartAnalysis: () => void;
};

export function DashboardQuickActions({
  showNewCase,
  onStartAnalysis,
}: DashboardQuickActionsProps) {
  if (!showNewCase) {
    return null;
  }

  return (
    <div className="flex flex-col justify-center gap-2 rounded-xl border border-graymatter-border bg-graymatter-card p-4">
      <Button
        onClick={onStartAnalysis}
        className="w-full bg-sky-600 hover:bg-sky-500"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        New study
      </Button>
    </div>
  );
}
