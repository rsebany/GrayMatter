"use client";

import { Box } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SegmentationResultDTO } from "@/api/domain";
import { resolveMeshUrl } from "@/api/clients";
import { ThreeViewer } from "@/components/features/viewer/xr/viewers/ThreeViewer";
import { useVolumeDisplayUnit } from "@/hooks/settings";
import {
  leftHippocampusMl,
  rightHippocampusMl,
  totalHippocampusMl,
} from "@/lib/metrics/hippocampus-metrics";
import {
  formatSegmentationVolumeNumber,
  formatSegmentationVolumeUnitLabel,
} from "@/lib/metrics/format-segmentation-volume";

type UploadXrPreviewSectionProps = {
  segmentation: SegmentationResultDTO | null;
  xrLoading: boolean;
  onOpenWebXR: () => void;
};

export function UploadXrPreviewSection({
  segmentation,
  xrLoading,
  onOpenWebXR,
}: UploadXrPreviewSectionProps) {
  const displayUnit = useVolumeDisplayUnit();
  const meshPath = segmentation?.xr_view?.mesh_url ?? "";
  const meshUrl = meshPath ? resolveMeshUrl(meshPath) : "";

  const totalVolumeMl = segmentation ? (totalHippocampusMl(segmentation) ?? 0) : 0;
  const leftMl = segmentation ? (leftHippocampusMl(segmentation) ?? 0) : 0;
  const rightMl = segmentation ? (rightHippocampusMl(segmentation) ?? 0) : 0;

  const totalDisplay = segmentation
    ? formatSegmentationVolumeNumber(displayUnit, {
        volumeMl: totalVolumeMl,
        burdenFraction: segmentation.ild_burden,
      })
    : "—";

  return (
    <aside className="flex flex-1 flex-col gap-6">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
          <h2 className="text-xs font-bold uppercase tracking-tighter">
            Spatial Reconstruction
          </h2>
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        </div>

        <div className="relative flex-1 bg-[#05070a]">
          {!segmentation ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-6 flex h-40 w-40 items-center justify-center rounded-full border border-primary/10 bg-primary/5">
                <Box className="h-12 w-12 text-primary/20" />
              </div>
              <h3 className="text-sm font-bold text-white">No Active Model</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Reconstruction will appear here once Residual U-Net segmentation is
                complete.
              </p>
            </div>
          ) : !meshUrl ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-6 flex h-40 w-40 items-center justify-center rounded-full border border-primary/10 bg-primary/5">
                <Box className="h-12 w-12 text-primary/20" />
              </div>
              <h3 className="text-sm font-bold text-white">No 3D Mesh Generated</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                No hippocampus regions were detected, so a 3D mesh was not generated.
                You can still review quantitative metrics and 2D slices.
              </p>
            </div>
          ) : (
            <div className="h-full">
              <ThreeViewer meshUrl={meshUrl} />

              <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
                  <p className="text-[9px] font-bold uppercase text-sky-400">
                    Total hippocampus
                  </p>
                  <p className="text-lg font-black text-white">
                    {totalDisplay}{" "}
                    <span className="text-[10px] font-normal text-slate-400">
                      {formatSegmentationVolumeUnitLabel(displayUnit)}
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
                  <p className="text-[9px] font-bold uppercase text-emerald-400">
                    Left
                  </p>
                  <p className="text-lg font-black text-white">
                    {leftMl.toFixed(2)}
                    <span className="text-[10px] font-normal text-slate-400">
                      {" "}
                      ml
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
                  <p className="text-[9px] font-bold uppercase text-violet-400">
                    Right
                  </p>
                  <p className="text-lg font-black text-white">
                    {rightMl.toFixed(2)}
                    <span className="text-[10px] font-normal text-slate-400">
                      {" "}
                      ml
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Button
        type="button"
        className="graymatter-cta w-full gap-2"
        disabled={!segmentation || !meshUrl || xrLoading}
        onClick={onOpenWebXR}
      >
        {xrLoading ? "Opening XR…" : "Open in WebXR"}
      </Button>
    </aside>
  );
}
