"use client";

import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  step: string;
  percentage: number;
  className?: string;
};

export function UploadAiProgressFooter({ step, percentage, className }: Props) {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
  const remaining = 100 - clamped;

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${step}, ${clamped} percent complete`}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-cyan-500/25 bg-background/95 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <Activity className="h-4 w-4 shrink-0 animate-spin text-cyan-500" aria-hidden />
            <span className="truncate font-semibold text-foreground">{step}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3 font-mono text-xs tabular-nums">
            <span className="font-semibold text-cyan-600 dark:text-cyan-400">{clamped}%</span>
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground">{remaining}% left</span>
          </div>
        </div>

        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-cyan-950/30 dark:bg-cyan-950/50">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 transition-[width] duration-500 ease-out motion-safe:animate-pulse"
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    </div>
  );
}
