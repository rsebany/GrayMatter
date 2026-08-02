"use client";

import type {
  MetricProgressGroup,
  MetricProgressItem,
} from "@/lib/metrics/metric-progress-types";

export type { MetricProgressGroup, MetricProgressItem };

type Props = {
  /** Grouped metrics (preferred). */
  groups?: MetricProgressGroup[];
  /** Flat list — used when `groups` is omitted. */
  items?: MetricProgressItem[];
  loading: boolean;
};

export function MetricProgressRows({ groups, items, loading }: Props) {
  const sections: MetricProgressGroup[] =
    groups && groups.length > 0
      ? groups
      : items && items.length > 0
        ? [{ title: "", items }]
        : [];

  return (
    <div className="flex-1 space-y-8">
      {sections.map((section) => (
        <div key={section.title || "metrics"} className="space-y-4">
          {section.title ? (
            <h4 className="border-b border-graymatter-border pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h4>
          ) : null}
          <div className="space-y-5">
            {section.items.map((stat) => (
              <div key={stat.label} className="group">
                <div className="mb-1 flex items-end justify-between gap-2">
                  <span className="min-w-0 text-[11px] font-medium leading-snug text-muted-foreground">
                    {stat.label}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                    {loading ? "…" : stat.val}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${stat.color} transition-all duration-1000`}
                    style={{ width: `${stat.progress ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
