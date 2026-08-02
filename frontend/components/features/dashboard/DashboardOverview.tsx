/**
 * Dashboard overview — composes KPI row, pipeline panel, and quick actions.
 */
"use client";

import type { DashboardMetrics } from "@/api/domain";

import { derivePipelineStats } from "@/lib/dashboard/pipeline-stats";
import type { CanFn } from "./_shared/types";
import { DashboardKpiRow } from "./DashboardKpiRow";
import { DashboardPipelinePanel } from "./DashboardPipelinePanel";
import { DashboardQuickActions } from "./DashboardQuickActions";

export type DashboardOverviewProps = {
  can: CanFn;
  patientsCount: number;
  studiesCount: number;
  dashboardMetrics?: DashboardMetrics | null;
  onStartAnalysis: () => void;
  kpiLoading?: boolean;
  kpiSkeletonCount?: number;
  workflowChartLoading?: boolean;
  /** True when there are no patients and no studies — CTAs live in the welcome row above. */
  workspaceEmpty?: boolean;
};

export function DashboardOverview({
  can,
  patientsCount,
  studiesCount,
  dashboardMetrics,
  onStartAnalysis,
  kpiLoading,
  kpiSkeletonCount = 4,
  workflowChartLoading,
  workspaceEmpty = false,
}: DashboardOverviewProps) {
  const stats = derivePipelineStats(studiesCount, dashboardMetrics);
  const showNewCase = can("upload_mri") && can("trigger_ai");
  const showXrLab = can("explore_3d_xr") || can("view_shared_3d");
  const showPipelineRow = can("quantitative_metrics");

  return (
    <div className="space-y-6">
      <DashboardKpiRow
        can={can}
        patientsCount={patientsCount}
        studiesCount={studiesCount}
        pendingCount={stats.pendingCount}
        completedToday={stats.completedToday}
        loading={kpiLoading}
        skeletonCount={kpiSkeletonCount}
      />

      {showPipelineRow && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <DashboardPipelinePanel
            can={can}
            stats={stats}
            studiesCount={studiesCount}
            workflowChartLoading={workflowChartLoading}
            workspaceEmpty={workspaceEmpty}
            showXrLab={showXrLab}
            showNewCase={showNewCase}
          />
          <DashboardQuickActions
            showNewCase={showNewCase}
            onStartAnalysis={onStartAnalysis}
          />
        </div>
      )}
    </div>
  );
}
