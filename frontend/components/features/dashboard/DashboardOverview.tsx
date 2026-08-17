/**
 * Dashboard overview — composes KPI row, pipeline panel, and quick actions.
 */
"use client";

import type { DashboardMetrics } from "@/api/domain";

import { derivePipelineStats } from "@/lib/dashboard/pipeline-stats";
import type { StudyTrendSeries, WorklistPeriodDays } from "@/lib/dashboard/study-trend";
import type { CanFn, WorklistFilter } from "./_shared/types";
import { DashboardKpiRow } from "./DashboardKpiRow";
import { DashboardPipelinePanel } from "./DashboardPipelinePanel";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardTrendChart } from "./DashboardTrendChart";

export type DashboardOverviewProps = {
  can: CanFn;
  patientsCount: number;
  studiesCount: number;
  studyTrend: StudyTrendSeries;
  dashboardMetrics?: DashboardMetrics | null;
  onStartAnalysis: () => void;
  kpiLoading?: boolean;
  kpiSkeletonCount?: number;
  workflowChartLoading?: boolean;
  /** True when there are no patients and no studies — CTAs live in the welcome row above. */
  workspaceEmpty?: boolean;
  periodDays: WorklistPeriodDays;
  statusFilter: WorklistFilter;
  onPeriodChange: (days: WorklistPeriodDays) => void;
  onStatusChange: (status: WorklistFilter) => void;
};

export function DashboardOverview({
  can,
  patientsCount,
  studiesCount,
  studyTrend,
  dashboardMetrics,
  onStartAnalysis,
  kpiLoading,
  kpiSkeletonCount = 4,
  workflowChartLoading,
  workspaceEmpty = false,
  periodDays,
  statusFilter,
  onPeriodChange,
  onStatusChange,
}: DashboardOverviewProps) {
  const stats = derivePipelineStats(studiesCount, dashboardMetrics);
  const showNewCase = can("upload_mri") && can("trigger_ai");
  const showWorklistFilter =
    can("quantitative_metrics") || can("manage_patients");
  const showXrLab = can("explore_3d_xr") || can("view_shared_3d");
  const showPipelineRow =
    can("quantitative_metrics") || showNewCase || showWorklistFilter;

  return (
    <div className="space-y-6">
      <DashboardKpiRow
        can={can}
        patientsCount={patientsCount}
        studiesCount={studiesCount}
        studyTrend={studyTrend}
        pendingCount={stats.pendingCount}
        completedToday={stats.completedToday}
        loading={kpiLoading}
        skeletonCount={kpiSkeletonCount}
      />

      {!workspaceEmpty && (
        <DashboardTrendChart
          can={can("quantitative_metrics")}
          trend={studyTrend}
          periodDays={periodDays}
          loading={workflowChartLoading}
        />
      )}

      {showPipelineRow && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {can("quantitative_metrics") && (
            <DashboardPipelinePanel
              can={can}
              stats={stats}
              studiesCount={studiesCount}
              workflowChartLoading={workflowChartLoading}
              workspaceEmpty={workspaceEmpty}
              showXrLab={showXrLab}
              showNewCase={showNewCase}
            />
          )}
          <DashboardQuickActions
            showNewCase={showNewCase}
            showWorklistFilter={showWorklistFilter}
            onStartAnalysis={onStartAnalysis}
            periodDays={periodDays}
            statusFilter={statusFilter}
            onPeriodChange={onPeriodChange}
            onStatusChange={onStatusChange}
          />
        </div>
      )}
    </div>
  );
}
