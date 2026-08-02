/**
 * Dashboard pipeline card — empty-state steps, progress bar, or loading skeleton.
 */
"use client";

import Link from "next/link";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { PipelineStats } from "@/lib/dashboard/pipeline-stats";
import type { CanFn } from "./_shared/types";
import { PipelineVisualSteps } from "./PipelineVisualSteps";

export type DashboardPipelinePanelProps = {
  can: CanFn;
  stats: PipelineStats;
  studiesCount: number;
  workflowChartLoading?: boolean;
  workspaceEmpty?: boolean;
  showXrLab: boolean;
  showNewCase: boolean;
};

export function DashboardPipelinePanel({
  can,
  stats,
  studiesCount,
  workflowChartLoading,
  workspaceEmpty = false,
  showXrLab,
  showNewCase,
}: DashboardPipelinePanelProps) {
  const pipelineHasStudies = studiesCount > 0;
  const showStudiesLink =
    !workflowChartLoading &&
    pipelineHasStudies &&
    can("quantitative_metrics");

  return (
    <div
      className={cn(
        "rounded-xl border border-graymatter-border bg-graymatter-card p-5 md:col-span-3",
        !workflowChartLoading &&
          !pipelineHasStudies &&
          "flex min-h-[248px] flex-col md:min-h-[260px]",
      )}
    >
      <div className="mb-3 flex shrink-0 items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Pipeline</h3>
        {showStudiesLink && (
          <Link
            href="/studies"
            className="shrink-0 text-xs text-sky-600 hover:underline"
          >
            All studies
          </Link>
        )}
      </div>

      {workflowChartLoading ? (
        <div
          className="h-16 animate-pulse rounded-lg bg-muted/50"
          aria-hidden
        />
      ) : !pipelineHasStudies ? (
        <PipelineEmptyState
          workspaceEmpty={workspaceEmpty}
          showXrLab={showXrLab}
          showNewCase={showNewCase}
        />
      ) : (
        <PipelineProgressBar stats={stats} />
      )}
    </div>
  );
}

type PipelineEmptyStateProps = {
  workspaceEmpty: boolean;
  showXrLab: boolean;
  showNewCase: boolean;
};

function PipelineEmptyState({
  workspaceEmpty,
  showXrLab,
  showNewCase,
}: PipelineEmptyStateProps) {
  if (workspaceEmpty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <PipelineVisualSteps showXrLab={showXrLab} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PipelineVisualSteps showXrLab={showXrLab} />
      <div className="space-y-2 border-t border-graymatter-border/80 pt-3">
        <p className="text-xs text-muted-foreground">
          No study on file yet for your current patients.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {showNewCase && (
            <Button
              asChild
              size="sm"
              className="h-8 bg-sky-600 hover:bg-sky-500"
            >
              <Link href="/upload-dicom">
                <Upload className="mr-2 h-3.5 w-3.5" />
                Upload HRCT
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href="/studies">Study browser</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function PipelineProgressBar({ stats }: { stats: PipelineStats }) {
  const { pendingCount, processedCount, pendingPct, processedPct } = stats;
  const showTurnaround =
    stats.avgTurnaroundHours != null && stats.avgTurnaroundHours > 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex h-3 w-full max-w-md overflow-hidden rounded-full bg-muted">
          <div
            className="h-full shrink-0 bg-amber-500"
            style={{ width: `${pendingPct}%` }}
          />
          <div
            className="h-full shrink-0 bg-emerald-500"
            style={{ width: `${processedPct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            Pending{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {pendingCount}
            </span>
          </span>
          <span>
            Processed{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {processedCount}
            </span>
          </span>
        </div>
      </div>
      {showTurnaround && (
        <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
          Avg turnaround{" "}
          <span className="font-medium tabular-nums text-foreground">
            {stats.avgTurnaroundHours!.toFixed(1)}h
          </span>
        </p>
      )}
    </div>
  );
}
