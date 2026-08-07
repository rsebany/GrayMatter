"use client";

import Link from "next/link";
import { FolderOpen, TrendingDown, TrendingUp } from "lucide-react";

import type { StudyTrendSeries } from "@/lib/dashboard/study-trend";

const CARD_COLOR = "#0076BC";

export type TotalStudiesKpiCardProps = {
  value: number;
  trend: StudyTrendSeries;
  can?: boolean;
};

export function TotalStudiesKpiCard({
  value,
  trend,
  can,
}: TotalStudiesKpiCardProps) {
  if (!can) return null;

  const change = trend.percentChange;
  const hasChange = change !== null;
  const isUp = hasChange && change >= 0;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <div
      className="h-[148px] overflow-hidden rounded-xl p-5 text-white shadow-sm transition-shadow hover:shadow-md"
      style={{ backgroundColor: CARD_COLOR }}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 [&_svg]:h-5 [&_svg]:w-5">
          <FolderOpen className="text-white" aria-hidden />
        </div>
        <Link
          href="/studies"
          className="text-xs text-white/75 transition-colors hover:text-white"
        >
          View →
        </Link>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <div className="text-4xl font-bold leading-none tabular-nums">{value}</div>
        <div className="flex items-center gap-1 pb-0.5 text-xs leading-tight text-white/85">
            {hasChange ? (
              <>
                <TrendIcon
                  className={`h-3.5 w-3.5 ${isUp ? "text-emerald-300" : "text-rose-300"}`}
                  aria-hidden
                />
                <span className="font-medium tabular-nums">
                  {Math.abs(change).toFixed(0)}%
                </span>
                <span>vs last {trend.periodDays} days</span>
              </>
            ) : (
              <span>
                {trend.periodDays === "all"
                  ? "All-time trend"
                  : "No prior period to compare"}
              </span>
            )}
        </div>
      </div>

      <p className="mt-1 text-sm font-medium text-white/90">Total Studies</p>
    </div>
  );
}
