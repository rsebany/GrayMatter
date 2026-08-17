/**
 * Dashboard trend card — daily study volume over the selected worklist period.
 */
"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";

import type { StudyTrendSeries, WorklistPeriodDays } from "@/lib/dashboard/study-trend";

const LINE_COLOR = "#0076BC";
const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardTrendChartProps = {
  can?: boolean;
  trend: StudyTrendSeries;
  periodDays: WorklistPeriodDays;
  loading?: boolean;
};

function periodLabel(periodDays: WorklistPeriodDays): string {
  return periodDays === "all" ? "All time" : `Last ${periodDays} days`;
}

function buildChartData(trend: StudyTrendSeries) {
  const { points, periodDays } = trend;

  if (periodDays === "all") {
    return points.map((value, index) => ({ index, label: "", value }));
  }

  const periodStart = Date.now() - periodDays * DAY_MS;
  return points.map((value, index) => {
    const date = new Date(periodStart + index * DAY_MS);
    return {
      index,
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value,
    };
  });
}

function TrendTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as { label?: string; value?: number } | undefined;
  if (!point || typeof point.value !== "number") return null;

  return (
    <div className="rounded-md border border-graymatter-border bg-graymatter-card px-2.5 py-1.5 text-xs shadow-sm">
      {point.label && <div className="text-muted-foreground">{point.label}</div>}
      <div className="font-semibold tabular-nums">
        {point.value} {point.value === 1 ? "study" : "studies"}
      </div>
    </div>
  );
}

export function DashboardTrendChart({
  can,
  trend,
  periodDays,
  loading,
}: DashboardTrendChartProps) {
  if (!can) return null;

  const data = buildChartData(trend);
  const isFlat = data.every((point) => point.value === 0);

  return (
    <div className="rounded-xl border border-graymatter-border bg-graymatter-card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Studies over time</h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {periodLabel(periodDays)}
        </span>
      </div>

      {loading ? (
        <div className="h-[160px] animate-pulse rounded-lg bg-muted/50" aria-hidden />
      ) : isFlat ? (
        <div className="flex h-[160px] items-center justify-center text-xs text-muted-foreground">
          No studies recorded in this period yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dashboardTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.18} />
                <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              hide={periodDays === "all"}
            />
            <YAxis hide allowDecimals={false} domain={[0, "dataMax"]} />
            <RechartsTooltip
              cursor={{ stroke: "var(--graymatter-border)", strokeWidth: 1 }}
              wrapperStyle={{ outline: "none" }}
              content={<TrendTooltip />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={LINE_COLOR}
              strokeWidth={2}
              fill="url(#dashboardTrendFill)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 3, fill: LINE_COLOR }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
