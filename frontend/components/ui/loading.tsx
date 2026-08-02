"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  /** Optional label shown next to the spinner */
  label?: string;
  /** When true, stretches to full viewport with background */
  fullscreen?: boolean;
  /** Extra classes for the outer container */
  className?: string;
  /** Extra classes for the spinner icon */
  iconClassName?: string;
}

export function LoadingState({
  label = "Loading…",
  fullscreen = false,
  className,
  iconClassName,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 text-slate-400",
        fullscreen && "min-h-screen bg-background",
        className
      )}
    >
      <Loader2
        className={cn(
          "h-6 w-6 animate-spin text-graymatter-accent",
          iconClassName
        )}
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function FullscreenLoading(props: Omit<LoadingStateProps, "fullscreen">) {
  return <LoadingState fullscreen {...props} />;
}

