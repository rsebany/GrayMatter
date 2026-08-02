import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { ArchitectureOption } from "@/api/domain";
import type { MetricProgressGroup } from "@/components/metrics";
import { View2DMetricsPanel } from "@/components/features/viewer/view2d/View2DMetricsPanel";

type Props = {
  metricGroups: MetricProgressGroup[];
  metricsLoading: boolean;
  reanalyzeError: string | null;
  canReanalyze: boolean;
  reanalyzeLoading: boolean;
  onRunAiAgain: () => void;
  architectures: ArchitectureOption[];
  architecturesLoading: boolean;
  selectedArchitectureId: string;
  onArchitectureChange: (architectureId: string) => void;
  activeArchitectureLabel?: string | null;
  viewerMode: "png" | "dicom3d";
  onViewerModeChange: (mode: "png" | "dicom3d") => void;
  studyId?: string | null;
  patientId?: string | null;
  /** Sidebar host route — controls the 2D ⇄ 3D switch link copy and target. */
  viewContext: "2d" | "3d";
};

export function View2DPanelRightColumn({
  metricGroups,
  metricsLoading,
  reanalyzeError,
  canReanalyze,
  reanalyzeLoading,
  onRunAiAgain,
  architectures,
  architecturesLoading,
  selectedArchitectureId,
  onArchitectureChange,
  activeArchitectureLabel,
  viewerMode,
  onViewerModeChange,
  studyId,
  patientId,
  viewContext,
}: Props) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  return (
    <div className="ml-2 flex shrink-0 items-stretch">
      {rightPanelOpen ? (
        <>
          <button
            type="button"
            onClick={() => setRightPanelOpen(false)}
            className="flex w-8 shrink-0 flex-col items-center justify-center rounded-l-lg border border-r-0 border-graymatter-border bg-graymatter-card text-muted-foreground transition-colors hover:bg-graymatter-card-hover hover:text-foreground"
            aria-label="Close segmentation result panel"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex w-full max-w-xs flex-col overflow-hidden">
            <View2DMetricsPanel
              metricGroups={metricGroups}
              metricsLoading={metricsLoading}
              reanalyzeError={reanalyzeError}
              canReanalyze={canReanalyze}
              reanalyzeLoading={reanalyzeLoading}
              onRunAiAgain={onRunAiAgain}
              architectures={architectures}
              architecturesLoading={architecturesLoading}
              selectedArchitectureId={selectedArchitectureId}
              onArchitectureChange={onArchitectureChange}
              activeArchitectureLabel={activeArchitectureLabel}
              viewerMode={viewerMode}
              onViewerModeChange={onViewerModeChange}
              studyId={studyId}
              patientId={patientId}
              activeViewer={viewContext}
            />
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setRightPanelOpen(true)}
          className="flex w-10 shrink-0 flex-col items-center justify-center rounded-l-xl border border-graymatter-border bg-graymatter-card text-muted-foreground transition-colors hover:bg-graymatter-card-hover hover:text-foreground"
          aria-label="Open segmentation result panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
