"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  WORKLIST_FILTER_OPTIONS,
  WORKLIST_PERIOD_OPTIONS,
} from "./_shared/constants";
import type { WorklistFilter } from "./_shared/types";
import type { WorklistPeriodDays } from "@/lib/dashboard/study-trend";

export type DashboardWorklistFilterProps = {
  periodDays: WorklistPeriodDays;
  statusFilter: WorklistFilter;
  onPeriodChange: (days: WorklistPeriodDays) => void;
  onStatusChange: (status: WorklistFilter) => void;
};

function filterSummary(
  periodDays: WorklistPeriodDays,
  statusFilter: WorklistFilter,
): string {
  const period =
    WORKLIST_PERIOD_OPTIONS.find((opt) => opt.id === periodDays)?.label ??
    (periodDays === "all" ? "All time" : `Last ${periodDays} days`);
  const status =
    WORKLIST_FILTER_OPTIONS.find((opt) => opt.id === statusFilter)?.label ??
    "All";
  return `${status} · ${period}`;
}

export function DashboardWorklistFilter({
  periodDays,
  statusFilter,
  onPeriodChange,
  onStatusChange,
}: DashboardWorklistFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full justify-between border-graymatter-border bg-background text-xs font-normal"
        >
          <span className="truncate">{filterSummary(periodDays, statusFilter)}</span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs">Period</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(periodDays)}
          onValueChange={(value) => {
            onPeriodChange(
              value === "all"
                ? "all"
                : (Number(value) as WorklistPeriodDays),
            );
          }}
        >
          {WORKLIST_PERIOD_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.id} value={String(opt.id)}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={statusFilter}
          onValueChange={(value) => onStatusChange(value as WorklistFilter)}
        >
          {WORKLIST_FILTER_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.id} value={opt.id}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
