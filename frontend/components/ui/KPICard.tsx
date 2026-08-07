"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface KPICardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  href?: string;
  badge?: string;
  color?: "blue" | "sky" | "amber" | "emerald";
  can?: boolean;
}

// Helper internal component to clean up the main render
export const KPICard = ({ icon, label, value, href, badge, color, can }: KPICardProps) => {
    if (!can) return null;
    const colors: Record<NonNullable<KPICardProps["color"]>, string> = {
      blue: "from-blue-500/5 hover:border-blue-500/30 hover:shadow-blue-500/5",
      sky: "from-sky-500/5 hover:border-sky-500/30 hover:shadow-sky-500/5",
      amber: "from-amber-500/5 hover:border-amber-500/30 hover:shadow-amber-500/5",
      emerald: "from-emerald-500/5 hover:border-emerald-500/30 hover:shadow-emerald-500/5",
    };
  
    return (
      <div className={`group relative h-[148px] overflow-hidden rounded-xl border border-graymatter-border bg-gradient-to-br p-5 transition-all hover:shadow-lg ${color ? colors[color] : ""}`}>
        <div className="flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/50 transition-transform group-hover:scale-105 [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </div>
          {href ? (
            <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">View →</Link>
          ) : (
            badge && <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold">{badge}</span>
          )}
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
        </div>
      </div>
    );
  };  