"use client";

import { FlaskConical } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { compareExpertMaskDicom } from "@/api/clients";
import type { ExpertMaskCompareResponse } from "@/api/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/api/http/client";
import Link from "next/link";

type ExpertMaskCompareSectionProps = {
  defaultStudyId: string | null;
};

export function ExpertMaskCompareSection({
  defaultStudyId,
}: ExpertMaskCompareSectionProps) {
  const [studyId, setStudyId] = React.useState("");
  const [expertFiles, setExpertFiles] = React.useState<File[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ExpertMaskCompareResponse | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (defaultStudyId && !studyId.trim()) {
      setStudyId(defaultStudyId);
    }
  }, [defaultStudyId, studyId]);

  const runCompare = React.useCallback(async () => {
    const sid = studyId.trim();
    if (!sid) {
      setError("Enter the study id (e.g. ST-fb225ee7).");
      return;
    }
    if (!expertFiles?.length) {
      setError("Choose expert mask DICOM files or a ZIP.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await compareExpertMaskDicom(sid, expertFiles);
      setResult(data);
      toast.success("Expert mask compared to AI prediction.");
    } catch (e: unknown) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Comparison failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [studyId, expertFiles]);

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 px-5 py-4 sm:px-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-500">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Expert mask vs AI (DICOM)
          </h3>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <label
            htmlFor="expert-compare-study-id"
            className="text-sm font-medium leading-none"
          >
            Study id
          </label>
          <Input
            id="expert-compare-study-id"
            placeholder="ST-…"
            value={studyId}
            onChange={(e) => setStudyId(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <label
            htmlFor="expert-mask-files"
            className="text-sm font-medium leading-none"
          >
            Expert mask (ZIP or .dcm)
          </label>
          <Input
            id="expert-mask-files"
            type="file"
            multiple
            className="cursor-pointer text-sm"
            onChange={(e) =>
              setExpertFiles(e.target.files ? Array.from(e.target.files) : null)
            }
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={loading}
          onClick={() => void runCompare()}
        >
          {loading ? "Comparing…" : "Compare"}
        </Button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="font-semibold">
              <Link
                href={`/view2d-expert-compare?studyId=${encodeURIComponent(result.study_id)}`}
              >
                Open 2D slice viewer
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="font-semibold">
              <Link
                href={`/view3d-expert-compare?studyId=${encodeURIComponent(result.study_id)}`}
              >
                Open 3D mesh viewer
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              2D: MRI + overlays side by side. 3D: AI vs expert GLBs (same colors as View 3D).
            </span>
          </div>
          {result.interpretation_hint ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              {result.interpretation_hint}
            </p>
          ) : null}
          <dl className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
              <dt className="text-muted-foreground">Expert shape [Z,Y,X]</dt>
              <dd className="font-mono text-xs">
                {result.expert_shape.join(" × ")}
              </dd>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
              <dt className="text-muted-foreground">Prediction shape [Z,Y,X]</dt>
              <dd className="font-mono text-xs">
                {result.prediction_shape.join(" × ")}
              </dd>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2 sm:col-span-2">
              <dt className="text-muted-foreground">
                Foreground overlap (expert &gt; 0 ∧ AI &gt; 0)
              </dt>
              <dd className="font-mono text-xs">
                {result.foreground_overlap_voxels.toLocaleString()} voxels · expert
                fg {result.expert_foreground_voxels.toLocaleString()} · AI fg{" "}
                {result.prediction_foreground_voxels.toLocaleString()} · exact
                label match {(result.voxel_agreement_fraction * 100).toFixed(2)}%
              </dd>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2 sm:col-span-2">
              <dt className="mb-1 text-muted-foreground">
                Voxel counts by label (0–3)
              </dt>
              <dd className="grid gap-1 font-mono text-[11px] sm:grid-cols-2">
                <span>
                  Expert:{" "}
                  {["0", "1", "2", "3"]
                    .map((k) => `${k}=${(result.voxel_count_expert[k] ?? 0).toLocaleString()}`)
                    .join(" · ")}
                </span>
                <span>
                  AI:{" "}
                  {["0", "1", "2", "3"]
                    .map(
                      (k) =>
                        `${k}=${(result.voxel_count_prediction[k] ?? 0).toLocaleString()}`,
                    )
                    .join(" · ")}
                </span>
              </dd>
            </div>
            {Object.entries(result.dice).map(([k, v]) => {
              const lesionClass = k.startsWith("dice_")
                ? k.slice("dice_".length)
                : k;
              const vac =
                lesionClass === "left" ||
                lesionClass === "right" ||
                lesionClass === "ggo" ||
                lesionClass === "reticulation"
                  ? Boolean(result.dice_vacuous_both_empty?.[lesionClass])
                  : false;
              return (
                <div
                  key={k}
                  className="rounded-lg border border-border/50 bg-background/80 px-3 py-2"
                >
                  <dt className="capitalize text-muted-foreground">
                    {k.replace(/_/g, " ")}
                    {vac ? (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        (both empty → Dice 1 is trivial)
                      </span>
                    ) : null}
                  </dt>
                  <dd className="font-mono">{v.toFixed(4)}</dd>
                </div>
              );
            })}
            {result.expert_inplane_correction &&
            result.expert_inplane_correction !== "none" ? (
              <div className="sm:col-span-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-100">
                <span className="font-medium">Orientation fix</span>
                <p className="mt-1">
                  Expert mask was auto-corrected ({result.expert_inplane_correction})
                  so left/right matches the study MRI and AI overlay.
                </p>
              </div>
            ) : null}
            {result.expert_remap_note || result.expert_labels_were_remapped ? (
              <div className="sm:col-span-2 rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Expert label remap</span>
                {result.expert_remap_mode ? (
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {result.expert_remap_mode}
                  </span>
                ) : null}
                {result.expert_remap_note ? (
                  <p className="mt-1 text-muted-foreground">{result.expert_remap_note}</p>
                ) : null}
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
