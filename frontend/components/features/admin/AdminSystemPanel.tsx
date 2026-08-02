"use client";

import { Activity, Cpu, HardDrive } from "lucide-react";

import { LoadingState } from "@/components/ui/loading";
import { GrayMatterPanel } from "@/components/layout";
import { useHealth } from "@/hooks/admin";

export function AdminSystemPanel() {
  const { data, isLoading, isError, error, refetch, isFetching } = useHealth();

  return (
    <GrayMatterPanel title="System Status" icon={Activity}>
      {isLoading ? (
        <LoadingState label="Checking API health…" className="h-24" iconClassName="h-5 w-5" />
      ) : isError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <p className="mb-2">
            {error instanceof Error ? error.message : "Health check failed."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatusTile
              icon={Activity}
              label="API"
              value={data.status}
              ok={data.status === "online"}
            />
            <StatusTile
              icon={Cpu}
              label="AI model"
              value={data.ai_model}
              ok={data.ai_model !== "unknown"}
            />
            <StatusTile
              icon={HardDrive}
              label="Storage"
              value={data.storage}
              ok={data.storage === "connected"}
            />
          </div>
          {data.xr?.api_base_url_for_headset && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Headset API base:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                {data.xr.api_base_url_for_headset}
              </code>
            </p>
          )}
          {isFetching && !isLoading && (
            <p className="text-xs text-muted-foreground">Refreshing…</p>
          )}
        </div>
      ) : null}
    </GrayMatterPanel>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-xl border border-graymatter-border bg-background/50 px-4 py-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className={
          ok
            ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400"
            : "text-sm font-semibold text-amber-600 dark:text-amber-400"
        }
      >
        {value}
      </p>
    </div>
  );
}
