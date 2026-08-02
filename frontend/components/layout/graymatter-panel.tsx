"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
};

/** Card-style panel using GrayMatter design tokens. */
export function GrayMatterPanel({ title, icon: Icon, children, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-graymatter-border bg-graymatter-card p-6",
        className,
      )}
    >
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
        <Icon className="h-5 w-5 text-graymatter-accent" />
        {title}
      </h2>
      {children}
    </div>
  );
}
