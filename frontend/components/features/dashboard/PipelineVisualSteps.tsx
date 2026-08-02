/**
 * Icon pipeline shown when the workspace has no studies yet (upload → AI → review → report).
 */
import type { LucideIcon } from "lucide-react";
import {
  Box,
  ChevronRight,
  FileDown,
  MonitorPlay,
  Sparkles,
  Upload,
} from "lucide-react";

type PipelineStep = {
  key: string;
  Icon: LucideIcon;
  label: string;
  className: string;
};

function buildPipelineSteps(showXrLab: boolean): PipelineStep[] {
  return [
    {
      key: "upload",
      Icon: Upload,
      label: "Upload DICOM",
      className: "border-sky-500/25 bg-sky-500/10 text-sky-700",
    },
    {
      key: "ai",
      Icon: Sparkles,
      label: "Run AI",
      className: "border-violet-500/25 bg-violet-500/10 text-violet-700",
    },
    {
      key: "read",
      Icon: MonitorPlay,
      label: "Read 2D",
      className: "border-amber-500/25 bg-amber-500/10 text-amber-800",
    },
    ...(showXrLab
      ? [
          {
            key: "xr",
            Icon: Box,
            label: "View 3D/XR",
            className: "border-sky-600/30 bg-sky-600/10 text-sky-800",
          },
        ]
      : []),
    {
      key: "report",
      Icon: FileDown,
      label: "Get Report",
      className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-800",
    },
  ];
}

export type PipelineVisualStepsProps = {
  showXrLab: boolean;
};

export function PipelineVisualSteps({ showXrLab }: PipelineVisualStepsProps) {
  const steps = buildPipelineSteps(showXrLab);

  return (
    <div
      className="flex min-h-[10rem] w-full flex-col justify-center px-3 py-6 sm:min-h-[11rem] sm:px-5"
      role="img"
      aria-label="Pipeline: Upload DICOM, Run AI, Read 2D, View 3D or XR, Get Report"
    >
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-center gap-0 sm:w-full sm:min-w-0">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center gap-0">
              {index > 0 ? (
                <div
                  className="flex h-10 w-5 shrink-0 items-center justify-center sm:w-6"
                  aria-hidden
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground/45" />
                </div>
              ) : null}
              <div
                className="flex w-[4.2rem] shrink-0 flex-col items-center gap-1.5 sm:min-w-0 sm:flex-1 sm:basis-0"
                aria-label={`Step ${index + 1}: ${step.label}`}
              >
                <span
                  className="text-[11px] font-semibold tabular-nums leading-none text-foreground sm:text-xs"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm sm:h-12 sm:w-12 ${step.className}`}
                >
                  <step.Icon
                    className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5"
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
                <span className="w-full px-0.5 text-center text-[9px] font-medium leading-snug text-muted-foreground sm:text-[10px]">
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
