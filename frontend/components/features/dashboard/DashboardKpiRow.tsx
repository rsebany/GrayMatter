/**
 * Dashboard KPI cards — patients, studies, pending, completed today.
 */
"use client";

import { CheckCircle2, Clock, FileText, Users } from "lucide-react";

import { KPICard } from "@/components/ui/KPICard";

import type { CanFn } from "./_shared/types";

export type DashboardKpiRowProps = {
  can: CanFn;
  patientsCount: number;
  studiesCount: number;
  pendingCount: number;
  completedToday: number;
  loading?: boolean;
  skeletonCount?: number;
};

export function DashboardKpiRow({
  can,
  patientsCount,
  studiesCount,
  pendingCount,
  completedToday,
  loading,
  skeletonCount = 4,
}: DashboardKpiRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={i}
            className="h-[132px] animate-pulse rounded-xl border border-graymatter-border bg-muted/40"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <KPICard
        icon={<Users className="text-blue-500" />}
        label="Active Patients"
        value={patientsCount}
        href="/patients"
        color="blue"
        can={can("manage_patients")}
      />
      <KPICard
        icon={<FileText className="text-sky-500" />}
        label="Total Studies"
        value={studiesCount}
        href="/studies"
        color="sky"
        can={can("quantitative_metrics")}
      />
      <KPICard
        icon={<Clock className="text-amber-500" />}
        label="Awaiting Review"
        value={pendingCount}
        badge="PENDING"
        color="amber"
        can={can("quantitative_metrics")}
      />
      <KPICard
        icon={<CheckCircle2 className="text-emerald-500" />}
        label="Done today"
        value={completedToday}
        badge="TODAY"
        color="emerald"
        can={can("quantitative_metrics")}
      />
    </div>
  );
}
