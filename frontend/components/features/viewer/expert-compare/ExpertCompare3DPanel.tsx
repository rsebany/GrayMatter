"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useSearchParams } from "next/navigation";

import type { DicomVolumeShape } from "@/api/domain";
import {
  getDicomVolumeShape,
  getExpertCompareExpertMeshUrl,
  getStudyMeshUrl,
} from "@/api/clients";
import {
  ThreeViewer,
  DEFAULT_MESH_CLASS_VISIBILITY,
  type MeshClassKey,
  type MeshClassVisibility,
} from "@/components/features/viewer/xr/viewers/ThreeViewer";
import { Button } from "@/components/ui/button";
import { imagingContextQuery, studyViewerHref } from "@/lib/imaging";

const CLASS_TOGGLE_META: Record<MeshClassKey, { label: string; swatch: string }> = {
  left: { label: "Left hippocampus", swatch: "bg-emerald-500" },
  right: { label: "Right hippocampus", swatch: "bg-indigo-500" },
  brain_shell: { label: "Brain", swatch: "bg-slate-400" },
};

function ClassVisibilityToggles({
  visibility,
  onToggle,
}: {
  visibility: Required<MeshClassVisibility>;
  onToggle: (key: MeshClassKey) => void;
}) {
  const order: MeshClassKey[] = ["left", "right", "brain_shell"];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
      <span className="shrink-0 pr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Show classes (both meshes)
      </span>
      {order.map((key) => {
        const meta = CLASS_TOGGLE_META[key];
        const active = visibility[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "border-border bg-background text-foreground"
                : "border-border/60 bg-muted/40 text-muted-foreground line-through opacity-70 hover:opacity-100"
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.swatch}`} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

export function ExpertCompare3DPanel() {
  const searchParams = useSearchParams();
  const studyId = (searchParams.get("studyId") ?? "").trim();
  const patientId = searchParams.get("patientId");

  const [aiMeshUrl, setAiMeshUrl] = React.useState<string>("");
  const [expertMeshUrl, setExpertMeshUrl] = React.useState<string>("");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [volumeShape, setVolumeShape] = React.useState<DicomVolumeShape | null>(null);
  const [classVisibility, setClassVisibility] = React.useState<Required<MeshClassVisibility>>(
    DEFAULT_MESH_CLASS_VISIBILITY,
  );

  const toggleClass = (key: MeshClassKey) =>
    setClassVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  React.useEffect(() => {
    if (!studyId) {
      setAiMeshUrl("");
      setExpertMeshUrl("");
      setVolumeShape(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const [ai, shape] = await Promise.all([
          getStudyMeshUrl(studyId),
          getDicomVolumeShape(studyId),
        ]);
        if (cancelled) return;
        setAiMeshUrl((ai ?? "").trim());
        setVolumeShape(shape);
        try {
          const expert = await getExpertCompareExpertMeshUrl(studyId);
          if (!cancelled) {
            setExpertMeshUrl((expert ?? "").trim());
            setLoadError(null);
          }
        } catch {
          if (!cancelled) {
            setExpertMeshUrl("");
            setLoadError(
              "Expert 3D mesh unavailable. Run **Compare** on Upload DICOM for this study first (saves expert_compare.npy).",
            );
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Could not load AI mesh or DICOM shape.");
          setAiMeshUrl("");
          setExpertMeshUrl("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  const axialCount = volumeShape?.depth ?? 0;
  const dicomContext3d =
    studyId && axialCount > 0
      ? {
          studyId,
          maxSlices: axialCount,
          currentSlice: Math.floor(axialCount / 2),
        }
      : null;

  const dicomSpacingMm = volumeShape
    ? {
        z: volumeShape.spacing_z_mm,
        y: volumeShape.spacing_y_mm,
        x: volumeShape.spacing_x_mm,
      }
    : null;

  const dicomVoxelCount = volumeShape
    ? {
        depth: volumeShape.depth,
        height: volumeShape.height,
        width: volumeShape.width,
      }
    : null;

  const uploadHref = `/upload-dicom${imagingContextQuery({ patientId, studyId: studyId || null })}`;
  const slice2dHref = studyViewerHref("/view2d", {
    studyId,
    patientId,
  }).replace("/view2d?", "/view2d-expert-compare?");

  if (!studyId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        <AlertCircle className="h-10 w-10 shrink-0 opacity-60" aria-hidden />
        <p>
          Add <span className="font-mono text-foreground">?studyId=ST-…</span> to the URL after
          running expert compare.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/upload-dicom">Upload DICOM</Link>
        </Button>
      </div>
    );
  }

  const hasDual = Boolean(aiMeshUrl && expertMeshUrl);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-graymatter-border bg-graymatter-card px-4 py-3">
        <div className="font-mono text-xs text-muted-foreground">
          {studyId}
          {loading ? " · loading meshes…" : hasDual ? " · left = AI, right = expert" : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href={slice2dHref}>2D compare</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href={uploadHref}>Upload / metrics</Link>
          </Button>
        </div>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {hasDual && <ClassVisibilityToggles visibility={classVisibility} onToggle={toggleClass} />}

      <div className="relative min-h-[min(70dvh,720px)] flex-1 overflow-hidden rounded-xl border border-border bg-[#020617] shadow-inner">
        {hasDual ? (
          <ThreeViewer
            meshUrl={aiMeshUrl}
            compareMeshUrl={expertMeshUrl}
            comparePrimaryPosition={[-0.38, 0, 0]}
            compareSecondaryPosition={[0.38, 0, 0]}
            usePlaceholder={false}
            showMesh
            visualPreset="anatomicalBrainSemi"
            classVisibility={classVisibility}
            dicomContext={dicomContext3d}
            dicomSpacingMm={dicomSpacingMm}
            dicomVoxelCount={dicomVoxelCount}
            dicomIncludeOverlay={false}
            dicomMaxStackSlices={160}
          />
        ) : (
          <div className="flex h-full min-h-[280px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : "Need both AI and expert meshes. Run AI analysis for this study, then run expert mask compare on Upload DICOM."}
          </div>
        )}
      </div>
    </div>
  );
}
