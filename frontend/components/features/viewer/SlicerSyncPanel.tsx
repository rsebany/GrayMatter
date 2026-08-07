"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Clipboard,
  Download,
  ExternalLink,
  History,
  Loader2,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { getSegmentationRevisionMask } from "@/api/clients";
import type { SegmentationRevisionInfo } from "@/api/domain";
import { getApiBaseUrl } from "@/api/http/client";
import {
  useRollbackSegmentationRevision,
  useSegmentationRevisions,
  useSegmentationSyncStatus,
} from "@/hooks/studies";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SlicerSyncPanelProps {
  studyId: string;
  connected: boolean;
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function buildPullCommand(studyId: string): string {
  const outputDirectory = `.\\slicer_workspace\\${studyId}`;
  const configuredApiBase = getApiBaseUrl();
  const apiBase =
    configuredApiBase.startsWith("http://") || configuredApiBase.startsWith("https://")
      ? configuredApiBase
      : new URL(configuredApiBase, window.location.origin).toString().replace(/\/+$/, "");
  return [
    "python backend/scripts/integrations/slicer_connect.py",
    `--api-base ${quotePowerShell(apiBase)}`,
    "pull",
    `--study-id ${quotePowerShell(studyId)}`,
    `--out-dir ${quotePowerShell(outputDirectory)}`,
  ].join(" ");
}

function revisionTime(revision: SegmentationRevisionInfo): string | null | undefined {
  return revision.accepted_at ?? revision.failed_at ?? revision.updated_at ?? revision.created_at;
}

export function SlicerSyncPanel({ studyId, connected }: SlicerSyncPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingRevision, setDownloadingRevision] = useState<number | null>(null);
  const statusQuery = useSegmentationSyncStatus(studyId);
  const revisionsQuery = useSegmentationRevisions(studyId);
  const rollback = useRollbackSegmentationRevision(studyId);
  const status = statusQuery.data;
  const latest = status?.latest;
  const pullCommand = buildPullCommand(studyId);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(pullCommand);
      setCopied(true);
      toast.success("Slicer pull command copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the command.");
    }
  };

  const downloadMask = async (revision: SegmentationRevisionInfo) => {
    setDownloadingRevision(revision.revision_id);
    try {
      const { blob, shape } = await getSegmentationRevisionMask(
        studyId,
        revision.revision_id,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${studyId}_revision-${revision.revision_id}_zyx-${shape.join("x")}.uint8.raw`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mask download failed.");
    } finally {
      setDownloadingRevision(null);
    }
  };

  const rollbackRevision = async (revision: SegmentationRevisionInfo) => {
    try {
      const result = await rollback.mutateAsync({
        revisionId: revision.revision_id,
        payload: {
          revision_note: `Rollback to revision ${revision.revision_id} from web`,
          module_name: "GrayMatter Web",
        },
      });
      toast.success(`Revision ${result.revision_id} created from rollback.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rollback failed.");
    }
  };

  return (
    <section className="rounded-xl border border-graymatter-border bg-graymatter-card">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              connected ? "bg-emerald-500" : "bg-amber-500",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">3D Slicer sync</h3>
              <Badge variant="outline">
                {connected ? "Live connection" : "Reconnecting"}
              </Badge>
              <Badge variant="secondary">
                Revision {status?.current_revision_id ?? 0}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {statusQuery.isLoading
                ? "Loading revision status…"
                : latest
                  ? `${latest.source} · ${formatTimestamp(revisionTime(latest))}${latest.revision_note ? ` · ${latest.revision_note}` : ""}`
                  : "No synchronized revisions yet."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="xs" variant="outline">
                <ExternalLink />
                Edit in 3D Slicer
              </Button>
            </DialogTrigger>
            <DialogContent className="p-5 sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit this study in 3D Slicer</DialogTitle>
                <DialogDescription>
                  Set <code>BEARER_TOKEN</code> in your terminal environment, then run this
                  pull command from the GrayMatter repository. The command never contains
                  your token.
                </DialogDescription>
              </DialogHeader>
              <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-xs leading-5">
                <code>{pullCommand}</code>
              </pre>
              <div className="flex justify-end">
                <Button size="sm" onClick={copyCommand}>
                  {copied ? <Check /> : <Clipboard />}
                  {copied ? "Copied" : "Copy command"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button size="xs" variant="ghost" aria-label="Toggle revision history">
                <History />
                History
                <ChevronDown
                  className={cn("transition-transform", historyOpen && "rotate-180")}
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      {latest?.status === "failed" && (
        <div className="mx-3 mb-3 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Latest sync failed</p>
            <p>{latest.failure_reason || "The server did not provide a failure reason."}</p>
          </div>
        </div>
      )}

      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleContent>
          <div className="border-t border-graymatter-border p-3">
            {revisionsQuery.isLoading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="animate-spin" /> Loading revision history…
              </p>
            ) : revisionsQuery.isError ? (
              <p className="text-xs text-destructive">Could not load revision history.</p>
            ) : revisionsQuery.data?.length ? (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {revisionsQuery.data.map((revision) => {
                  const isCurrent = revision.revision_id === status?.current_revision_id;
                  const canRollback = revision.status === "accepted" && !isCurrent;
                  return (
                    <article
                      key={revision.revision_id}
                      className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/60 p-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">Revision {revision.revision_id}</span>
                          <Badge
                            variant={
                              revision.status === "failed" ? "destructive" : "outline"
                            }
                          >
                            {revision.status}
                          </Badge>
                          {isCurrent && <Badge variant="secondary">Current</Badge>}
                          {revision.rollback_of_revision_id != null && (
                            <span className="text-muted-foreground">
                              rollback of {revision.rollback_of_revision_id}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {revision.source} · {formatTimestamp(revisionTime(revision))}
                          {revision.workstation_id ? ` · ${revision.workstation_id}` : ""}
                        </p>
                        {revision.revision_note && (
                          <p className="mt-0.5 break-words">{revision.revision_note}</p>
                        )}
                        {revision.failure_reason && (
                          <p className="mt-0.5 break-words text-destructive">
                            {revision.failure_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => downloadMask(revision)}
                          disabled={
                            revision.status !== "accepted" ||
                            downloadingRevision === revision.revision_id
                          }
                          title="Download raw uint8 mask"
                        >
                          {downloadingRevision === revision.revision_id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Download />
                          )}
                          <span className="sr-only">Download revision mask</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              disabled={!canRollback || rollback.isPending}
                              title={
                                isCurrent
                                  ? "This is the current revision"
                                  : "Rollback as a new revision"
                              }
                            >
                              <RotateCcw />
                              <span className="sr-only">Rollback revision</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Roll back to revision {revision.revision_id}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This preserves history by creating a new accepted revision
                                from the selected mask. It does not delete newer revisions.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel
                                className={buttonVariants({ variant: "outline" })}
                              >
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                className={buttonVariants({ variant: "destructive" })}
                                onClick={() => rollbackRevision(revision)}
                              >
                                Create rollback revision
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Revision history is empty.
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
