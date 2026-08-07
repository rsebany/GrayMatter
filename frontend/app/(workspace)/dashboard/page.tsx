/**
 * Practitioner dashboard — KPIs, pipeline overview, and recent worklist.
 */
"use client";

import { useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/layout";
import { DashboardEmptyBanner } from "@/components/features/dashboard/DashboardEmptyBanner";
import { DashboardOverview } from "@/components/features/dashboard/DashboardOverview";
import { RecentStudiesSection } from "@/components/features/dashboard/RecentStudiesSection";
import { AddCaseSheet } from "@/components/features/studies/AddCaseSheet";
import type { WorklistFilter } from "@/components/features/dashboard/_shared/types";
import { useDashboardMetrics } from "@/hooks/analytics";
import { useRole } from "@/hooks/app";
import { useRecentStudies } from "@/hooks/dashboard";
import { usePatients } from "@/hooks/patients";
import { useSettings } from "@/hooks/settings";
import { useStudies } from "@/hooks/studies";
import {
  buildStudyTrendSeries,
  filterStudiesForWorklist,
  type WorklistPeriodDays,
} from "@/lib/dashboard";

const DASHBOARD_RECENT_STUDIES_LIMIT = 5;

export default function DoctorDashboard() {
  const [addCaseOpen, setAddCaseOpen] = useState(false);
  const [periodDays, setPeriodDays] = useState<WorklistPeriodDays>(30);
  const [statusFilter, setStatusFilter] = useState<WorklistFilter>("all");

  const { can } = useRole();
  const { data: patientsData, isPending: patientsPending } = usePatients();
  const { data: studiesData, isPending: studiesPending } = useStudies();
  const { data: settings } = useSettings();
  const { data: dashboardMetrics, isPending: metricsPending } =
    useDashboardMetrics();

  const patients = Array.isArray(patientsData) ? patientsData : [];
  const studies = Array.isArray(studiesData) ? studiesData : [];

  const filteredStudies = useMemo(
    () => filterStudiesForWorklist(studies, periodDays, statusFilter),
    [studies, periodDays, statusFilter],
  );

  const studyTrend = useMemo(
    () => buildStudyTrendSeries(studies, periodDays),
    [studies, periodDays],
  );

  const recentStudies = useRecentStudies(
    patients,
    DASHBOARD_RECENT_STUDIES_LIMIT,
    filteredStudies,
  );

  const listsLoading = patientsPending || studiesPending;
  const workspaceEmpty =
    !listsLoading && patients.length === 0 && studies.length === 0;

  const kpiSkeletonCount =
    (can("manage_patients") ? 1 : 0) + (can("quantitative_metrics") ? 3 : 0);

  const kpiLoading =
    kpiSkeletonCount > 0 &&
    (listsLoading || (metricsPending && dashboardMetrics === undefined));

  return (
    <>
      <WorkspaceShell activePage="dashboard" title="Dashboard">
        {workspaceEmpty && (
          <DashboardEmptyBanner
            canUpload={can("upload_mri") && can("trigger_ai")}
            canManagePatients={can("manage_patients")}
          />
        )}
        <DashboardOverview
          can={can}
          patientsCount={patients.length}
          studiesCount={dashboardMetrics?.studies_count ?? studies.length}
          studyTrend={studyTrend}
          dashboardMetrics={dashboardMetrics}
          onStartAnalysis={() => setAddCaseOpen(true)}
          kpiLoading={kpiLoading}
          kpiSkeletonCount={kpiSkeletonCount}
          workflowChartLoading={listsLoading}
          workspaceEmpty={workspaceEmpty}
          periodDays={periodDays}
          statusFilter={statusFilter}
          onPeriodChange={setPeriodDays}
          onStatusChange={setStatusFilter}
        />
        <RecentStudiesSection
          recentStudies={recentStudies}
          can={can}
          defaultView={settings?.default_view}
          listLoading={listsLoading}
          worklistLimit={DASHBOARD_RECENT_STUDIES_LIMIT}
          periodDays={periodDays}
          statusFilter={statusFilter}
          totalStudiesInScope={filteredStudies.length}
        />
      </WorkspaceShell>
      <AddCaseSheet open={addCaseOpen} onOpenChange={setAddCaseOpen} />
    </>
  );
}
