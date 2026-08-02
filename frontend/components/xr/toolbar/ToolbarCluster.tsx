"use client";

import type { ReactNode } from "react";

export function ToolbarCluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5 sm:gap-2"
    >
      {children}
    </div>
  );
}
