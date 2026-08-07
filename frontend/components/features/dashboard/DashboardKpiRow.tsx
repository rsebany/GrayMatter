/**
 * Dashboard KPI cards — studies, patients, pending, completed today.
 */
"use client";

import { CheckCircle2, Clock, Users } from "lucide-react";

import { KPICard } from "@/components/ui/KPICard";
import type { StudyTrendSeries } from "@/lib/dashboard/study-trend";

import type { CanFn } from "./_shared/types";
import { TotalStudiesKpiCard } from "./TotalStudiesKpiCard";

export type DashboardKpiRowProps = {
  can: CanFn;
  patientsCount: number;
  studiesCount: number;
  studyTrend: StudyTrendSeries;
  pendingCount: number;
  completedToday: number;
  loading?: boolean;
  skeletonCount?: number;
};

export function DashboardKpiRow({
  can,
  patientsCount,
  studiesCount,
  studyTrend,
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
      <TotalStudiesKpiCard
        value={studiesCount}
        trend={studyTrend}
        can={can("quantitative_metrics")}
      />
      <KPICard
        icon={<Users className="text-blue-500" />}
        label="Active Patients"
        value={patientsCount}
        href="/patients"
        color="blue"
        can={can("manage_patients")}
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
