"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useSearchParams } from "next/navigation";

import { getDicomVolumeShape, getExpertCompareSliceUrl } from "@/api/clients";
import { Button } from "@/components/ui/button";
import { imagingContextQuery, studyViewerHref } from "@/lib/imaging";

const WINDOW_CENTER = -600;
const WINDOW_WIDTH = 1500;
const OVERLAY_OPACITY = 0.6;

export function ExpertCompare2DPanel() {
  const searchParams = useSearchParams();
  const studyId = (searchParams.get("studyId") ?? "").trim();
  const patientId = searchParams.get("patientId");

  const [depth, setDepth] = React.useState<number>(0);
  const [sliceIndex, setSliceIndex] = React.useState(0);
  const [shapeError, setShapeError] = React.useState<string | null>(null);
  const [imgError, setImgError] = React.useState<string | null>(null);
  const [shapeLoading, setShapeLoading] = React.useState(false);
  const [visibleUrl, setVisibleUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!studyId) {
      setDepth(0);
      return;
    }
    let cancelled = false;
    setShapeLoading(true);
    setShapeError(null);
    void getDicomVolumeShape(studyId)
      .then((shape) => {
        if (cancelled) return;
        if (!shape || shape.depth < 1) {
          setShapeError("Could not load DICOM shape for this study.");
          setDepth(0);
          return;
        }
        setDepth(shape.depth);
        setSliceIndex((z) => Math.min(z, Math.max(0, shape.depth - 1)));
      })
      .catch(() => {
        if (!cancelled) {
          setShapeError("Failed to load study geometry.");
          setDepth(0);
        }
      })
      .finally(() => {
        if (!cancelled) setShapeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  const safeZ = Math.max(0, Math.min(sliceIndex, Math.max(depth - 1, 0)));
  const pngUrl = React.useMemo(() => {
    if (!studyId || depth < 1) return null;
    return getExpertCompareSliceUrl(studyId, safeZ, {
      windowCenter: WINDOW_CENTER,
      windowWidth: WINDOW_WIDTH,
      overlayOpacity: OVERLAY_OPACITY,
    });
  }, [studyId, depth, safeZ]);

  React.useEffect(() => {
    if (!pngUrl) {
      setVisibleUrl(null);
      return;
    }
    let cancelled = false;
    setImgError(null);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setVisibleUrl(pngUrl);
        setImgError(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setVisibleUrl(null);
        setImgError(
          "Could not load comparison image. Run **Compare** on Upload DICOM for this study first (saves expert volume for preview).",
        );
      }
    };
    img.src = pngUrl;
    return () => {
      cancelled = true;
    };
  }, [pngUrl]);

  React.useEffect(() => {
    if (!studyId || depth < 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        setSliceIndex((z) => Math.max(0, z - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        setSliceIndex((z) => Math.min(depth - 1, z + 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setSliceIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSliceIndex(depth - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studyId, depth]);

  const uploadHref = `/upload-dicom${imagingContextQuery({ patientId, studyId: studyId || null })}`;
  const view3dHref = studyViewerHref("/view3d", {
    studyId,
    patientId,
  }).replace("/view3d?", "/view3d-expert-compare?");

  if (!studyId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        <AlertCircle className="h-10 w-10 shrink-0 opacity-60" aria-hidden />
        <p>
          Add <span className="font-mono text-foreground">?studyId=ST-…</span> to the URL, or open
          this page from Upload DICOM after running expert compare.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/upload-dicom">Go to Upload DICOM</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-graymatter-border bg-graymatter-card px-4 py-3">
        <div className="font-mono text-xs text-muted-foreground">
          {studyId}
          {shapeLoading ? " · loading…" : depth > 0 ? ` · axial ${safeZ + 1} / ${depth}` : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href={uploadHref}>Back to compare</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link
              href={view3dHref}
            >
              3D meshes
            </Link>
          </Button>
        </div>
      </div>

      {shapeError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {shapeError}
        </p>
      )}
      {imgError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {imgError}
        </p>
      )}

      {depth > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="min-w-[6rem] text-sm text-muted-foreground" htmlFor="expert-compare-z">
              Slice (axial)
            </label>
            <input
              id="expert-compare-z"
              type="range"
              min={0}
              max={depth - 1}
              value={safeZ}
              onChange={(e) => setSliceIndex(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-violet-500"
            />
          </div>

          <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-graymatter-border bg-black">
            {visibleUrl ? (
              <img
                src={visibleUrl}
                alt={`Expert vs AI axial slice ${safeZ + 1}`}
                className="max-h-[min(72vh,920px)] w-full object-contain select-none"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Loading slice…
              </span>
            )}
            <div className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3 py-2 text-[10px] uppercase tracking-widest text-slate-300">
              Left: AI · Right: expert · ←/→ slice
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
