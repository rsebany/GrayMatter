import React from "react";
import Link from "next/link";
import { BarChart, Layers, RefreshCw, Scan } from "lucide-react";

import type { ArchitectureOption } from "@/api/domain";
import { Button } from "@/components/ui/button";
import {
  MetricProgressRows,
  type MetricProgressGroup,
} from "@/components/metrics";
import { ViewerPipelineLinks } from "@/components/features/viewer/pipeline/viewer-pipeline-links";

type View2DMetricsPanelProps = {
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
  /** Reserved for future viewer mode toggle (2D PNG vs 3D DICOM stack). */
  viewerMode?: "png" | "dicom3d";
  onViewerModeChange?: (mode: "png" | "dicom3d") => void;
  studyId?: string | null;
  patientId?: string | null;
  /** Which viewer this sidebar is shown on — drives the primary switch link. */
  activeViewer: "2d" | "3d";
};

function formatDice(score: number | null | undefined): string | null {
  if (score == null || Number.isNaN(score)) return null;
  return `Val Dice ${(score * 100).toFixed(1)}%`;
}

export function View2DMetricsPanel({
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
  viewerMode: _viewerMode,
  onViewerModeChange: _onViewerModeChange,
  studyId,
  patientId,
  activeViewer,
}: View2DMetricsPanelProps) {
  const totalRows = metricGroups.reduce((n, g) => n + g.items.length, 0);
  const hasCompletedAnalysis = totalRows > 0 && !metricsLoading;

  const selectedArch = architectures.find((item) => item.id === selectedArchitectureId);
  const engineLabel =
    activeArchitectureLabel ??
    selectedArch?.label ??
    (architecturesLoading ? "Loading…" : "Residual U-Net");

  const qs = new URLSearchParams();
  if (studyId) qs.set("studyId", studyId);
  if (patientId) qs.set("patientId", patientId);
  const q = qs.toString();
  const switchHref =
    activeViewer === "3d" ? `/view2d?${q}` : `/view3d?${q}`;
  const switchLabel =
    activeViewer === "3d" ? "View 2D slices" : "View 3D reconstruction";
  const SwitchIcon = activeViewer === "3d" ? Scan : Layers;

  return (
    <div className="flex w-full max-w-xs flex-col gap-6">
      <section className="flex h-full flex-col rounded-2xl border border-graymatter-border bg-graymatter-card p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <BarChart className="h-4 w-4 shrink-0 text-sky-500" />{" "}
            <span className="truncate">Segmentation Results</span>
          </h3>
        </div>

        {studyId ? (
          <div className="mb-5">
            <Button
              asChild
              variant="outline"
              className="h-11 w-full justify-center gap-2 rounded-xl border-sky-500/40 bg-sky-500/5 text-sm font-semibold text-foreground hover:bg-sky-500/10"
            >
              <Link href={switchHref}>
                <SwitchIcon className="h-4 w-4 text-sky-600" />
                {switchLabel}
              </Link>
            </Button>
          </div>
        ) : null}

        <MetricProgressRows groups={metricGroups} loading={metricsLoading} />

        <div className="mt-auto space-y-3 border-t border-graymatter-border pt-6">
          {reanalyzeError && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
              {reanalyzeError}
            </p>
          )}

          {hasCompletedAnalysis && studyId && (
            <ViewerPipelineLinks studyId={studyId} patientId={patientId} />
          )}

          <div className="space-y-2 rounded-xl border border-sky-500/10 bg-sky-500/5 p-4">
            <p className="mb-1 text-[10px] font-bold uppercase text-sky-500">
              Inference Engine
            </p>
            {architectures.length > 0 ? (
              <select
                value={selectedArchitectureId}
                onChange={(event) => onArchitectureChange(event.target.value)}
                disabled={reanalyzeLoading || architecturesLoading}
                className="h-10 w-full rounded-lg border border-graymatter-border bg-background px-3 text-sm font-medium text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50"
                aria-label="Segmentation architecture"
              >
                {architectures.map((arch) => {
                  const dice = formatDice(arch.best_val_dice);
                  const suffix = [
                    arch.is_default ? "default" : null,
                    dice,
                    !arch.available ? "unavailable" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <option key={arch.id} value={arch.id} disabled={!arch.available}>
                      {arch.label}
                      {suffix ? ` (${suffix})` : ""}
                    </option>
                  );
                })}
              </select>
            ) : (
              <p className="text-xs font-bold text-foreground">{engineLabel}</p>
            )}
            {activeArchitectureLabel && selectedArch?.label !== activeArchitectureLabel ? (
              <p className="text-[11px] text-muted-foreground">
                Last run: {activeArchitectureLabel}
              </p>
            ) : null}
          </div>

          <Button
            onClick={onRunAiAgain}
            disabled={!canReanalyze || reanalyzeLoading || !selectedArchitectureId}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {reanalyzeLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Running AI…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run AI analysis
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}
