"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { studyService, type DicomVolumeShape } from "@/services/study";
import type { StudySyncEvent } from "@/api/domain";
import { apiFetchRaw, buildApiUrl } from "@/api/http/client";
import {
  ThreeViewer,
  type MeshClassKey,
  type MeshClassVisibility,
} from "@/components/features/viewer/xr/viewers/ThreeViewer";
import { imagingContextFromSearchParams } from "@/lib/imaging";
import { buildSegmentationMetricGroups } from "@/lib/metrics/segmentation-metric-groups";
import {
  defaultWindowPresetKey,
  windowPresetsForModality,
} from "@/lib/viewer/window-presets";
import { useVolumeDisplayUnit } from "@/hooks/settings";
import {
  segmentationSyncKeys,
  useStudiesList,
  useStudyMetrics,
  useArchitectureSelection,
} from "@/hooks/studies";
import {
  useDicomLoader,
  useResolvedStudyId,
  useViewerCaseContext,
} from "@/hooks/viewer";
import { View2DPanelLeftColumn } from "@/components/features/viewer/view2d/View2DPanelLeftColumn";
import { View2DPanelRightColumn } from "@/components/features/viewer/view2d/View2DPanelRightColumn";
import { SegmentationClassLegend } from "@/components/features/viewer/ui/SegmentationClassLegend";
import { Switch } from "@/components/ui/switch";
import { SlicerSyncPanel } from "@/components/features/viewer/SlicerSyncPanel";

type Orientation = "axial" | "coronal" | "sagittal";
type SurfaceRenderMode = "semi" | "solid";

const BRAIN_DEFAULT_CLASS_VISIBILITY: Required<MeshClassVisibility> = {
  left: true,
  right: true,
  brain_shell: true,
};

export function View3DReconstructionPanel() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { patientId, studyId: studyIdParam } = imagingContextFromSearchParams(searchParams);
  const meshFallback = searchParams.get("mesh");

  const studyId = useResolvedStudyId({ studyIdParam, patientId });

  const { files, status: dicomLoadStatus, error: dicomLoadError } = useDicomLoader(
    studyId,
    Boolean(studyId),
  );
  const { data: studies } = useStudiesList();
  const { data: metrics, isLoading: metricsLoading } = useStudyMetrics(studyId || undefined);
  const {
    architectures,
    architecturesLoading,
    selectedArchitectureId,
    setSelectedArchitectureId,
    activeArchitectureLabel,
  } = useArchitectureSelection(metrics);
  const { patientName, studyLine } = useViewerCaseContext(studyId, patientId || null);

  const studyModality = useMemo(() => {
    const study = studies?.find((s) => s.study_id === studyId);
    return (study?.modality ?? "mri").toLowerCase();
  }, [studies, studyId]);

  const windowPresets = useMemo(
    () => windowPresetsForModality(studyModality),
    [studyModality],
  );
  const defaultPresetKey = defaultWindowPresetKey(studyModality);
  const defaultPreset = windowPresets[defaultPresetKey];

  const [windowPreset, setWindowPreset] = useState(defaultPresetKey);
  const [windowCenter, setWindowCenter] = useState(defaultPreset.center);
  const [windowWidth, setWindowWidth] = useState(defaultPreset.width);
  const [denoise, setDenoise] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>("axial");
  const [viewerMode] = useState<"png">("png");
  const [reanalyzeLoading, setReanalyzeLoading] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
  const [meshReloadToken, setMeshReloadToken] = useState(0);
  const [syncConnected, setSyncConnected] = useState(false);
  const lastAcceptedRevisionRef = useRef(0);
  /** On by default so the marching-cubes GLB (same asset as XR lab) is visible, including in WebXR. */
  const [showAiMesh, setShowAiMesh] = useState(true);
  const [hasSegmentationMesh, setHasSegmentationMesh] = useState(false);
  const [classVisibility, setClassVisibility] = useState<Required<MeshClassVisibility>>(
    BRAIN_DEFAULT_CLASS_VISIBILITY,
  );
  const [showVolumeStack, setShowVolumeStack] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [surfaceRenderMode, setSurfaceRenderMode] = useState<SurfaceRenderMode>("semi");
  const [volumeShape, setVolumeShape] = useState<DicomVolumeShape | null>(null);
  const [volumeShapeLoading, setVolumeShapeLoading] = useState(false);

  const toggleClass = (key: MeshClassKey) =>
    setClassVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  const [meshUrl, setMeshUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studyId) {
      setMeshUrl(meshFallback);
      setError(null);
      setLoading(false);
      setHasSegmentationMesh(!!(meshFallback && String(meshFallback).length > 0));
      return;
    }
    setLoading(true);
    setError(null);
    studyService
      .getMeshUrl(studyId)
      .then((url) => {
        const u = (url || meshFallback || "").trim();
        setMeshUrl(url || meshFallback);
        setHasSegmentationMesh(u.length > 0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load mesh.");
        setMeshUrl(meshFallback);
        setHasSegmentationMesh(!!(meshFallback && String(meshFallback).trim().length > 0));
      })
      .finally(() => setLoading(false));
  }, [studyId, meshFallback, meshReloadToken]);

  useEffect(() => {
    if (!studyId) {
      setSyncConnected(false);
      lastAcceptedRevisionRef.current = 0;
      return;
    }

    const controller = new AbortController();
    let reconnectTimer: number | undefined;

    const handleSyncEvent = (event: StudySyncEvent) => {
      if (event.event === "segmentation.status") {
        const revision = event.current_revision_id || 0;
        lastAcceptedRevisionRef.current = Math.max(
          lastAcceptedRevisionRef.current,
          revision,
        );
        const meshPath = event.latest?.mesh_url;
        if (meshPath) {
          const resolved = buildApiUrl(meshPath);
          setMeshUrl(
            `${resolved}${resolved.includes("?") ? "&" : "?"}revision=${revision}`,
          );
          setHasSegmentationMesh(true);
        }
        void queryClient.invalidateQueries({
          queryKey: segmentationSyncKeys.status(studyId),
        });
        return;
      }

      const revision = event.revision_id || 0;
      if (revision <= lastAcceptedRevisionRef.current) return;
      lastAcceptedRevisionRef.current = revision;

      if (event.mesh_url) {
        const resolved = buildApiUrl(event.mesh_url);
        setMeshUrl(
          `${resolved}${resolved.includes("?") ? "&" : "?"}revision=${revision}`,
        );
        setHasSegmentationMesh(true);
        setShowAiMesh(true);
        setError(null);
      } else {
        setMeshReloadToken((token) => token + 1);
      }

      toast.success(`3D Slicer revision ${revision} synchronized.`, {
        id: `slicer-sync-${studyId}-${revision}`,
      });

      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["studies", "metrics", studyId],
        }),
        queryClient.invalidateQueries({ queryKey: ["studies"] }),
        queryClient.invalidateQueries({
          queryKey: segmentationSyncKeys.status(studyId),
        }),
        queryClient.invalidateQueries({
          queryKey: segmentationSyncKeys.revisions(studyId),
        }),
      ]);
    };

    const connect = async () => {
      if (controller.signal.aborted) return;
      try {
        const response = await apiFetchRaw(
          `/studies/${encodeURIComponent(studyId)}/events`,
          {
            method: "GET",
            headers: { Accept: "text/event-stream" },
            signal: controller.signal,
            jsonBody: false,
          },
        );
        if (!response.body) throw new Error("SSE response body is unavailable.");
        setSyncConnected(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            let eventName = "message";
            const dataLines: string[] = [];
            for (const line of block.split("\n")) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
            }
            if (dataLines.length) {
              try {
                const payload = JSON.parse(dataLines.join("\n")) as Record<
                  string,
                  unknown
                >;
                handleSyncEvent({
                  ...payload,
                  event: (payload.event as string | undefined) ?? eventName,
                } as StudySyncEvent);
              } catch {
                // Ignore malformed event payloads and keep the stream alive.
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch (streamError) {
        if (!controller.signal.aborted) {
          console.warn("Study sync stream disconnected.", streamError);
        }
      } finally {
        if (!controller.signal.aborted) setSyncConnected(false);
      }
      if (!controller.signal.aborted) {
        reconnectTimer = window.setTimeout(() => void connect(), 2000);
      }
    };

    void connect();
    return () => {
      controller.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      setSyncConnected(false);
    };
  }, [queryClient, studyId]);

  useEffect(() => {
    const preset = windowPresets[defaultPresetKey];
    setWindowPreset(defaultPresetKey);
    setWindowCenter(preset.center);
    setWindowWidth(preset.width);
  }, [studyId, studyModality, defaultPresetKey, windowPresets]);

  useEffect(() => {
    setFlipVertical(false);
  }, [studyId]);

  useEffect(() => {
    if (!studyId) {
      setVolumeShape(null);
      setShowVolumeStack(false);
      return;
    }
    let cancelled = false;
    setVolumeShapeLoading(true);
    studyService
      .getDicomVolumeShape(studyId)
      .then((shape) => {
        if (!cancelled) setVolumeShape(shape);
      })
      .catch(() => {
        if (!cancelled) setVolumeShape(null);
      })
      .finally(() => {
        if (!cancelled) setVolumeShapeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  useEffect(() => {
    if (hasSegmentationMesh) {
      setShowAiMesh(true);
    } else {
      setShowAiMesh(false);
    }
  }, [hasSegmentationMesh]);

  useEffect(() => {
    setClassVisibility(BRAIN_DEFAULT_CLASS_VISIBILITY);
  }, [studyId]);

  const volumeDisplayUnit = useVolumeDisplayUnit();
  const metricGroups = useMemo(
    () => buildSegmentationMetricGroups(metrics, volumeDisplayUnit),
    [metrics, volumeDisplayUnit],
  );

  const resolvedUrl = meshUrl || meshFallback;
  const usePlaceholder = !resolvedUrl;

  const showMeshInViewer = showAiMesh && hasSegmentationMesh;
  const meshUrlForViewer = (meshUrl || meshFallback || "").trim();

  const axialCount = volumeShape?.depth ?? 0;
  const dicomContext3d =
    showVolumeStack && studyId && axialCount > 0
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
  const canShowVolumeStack = Boolean(studyId && axialCount > 0);
  const hasVolume = Boolean((files && files.length > 0) || axialCount > 0);
  const meshVisualPreset =
    surfaceRenderMode === "solid" ? "anatomicalBrain" : "anatomicalBrainSemi";

  const onRunAiAgain = async () => {
    if (!studyId || !selectedArchitectureId) return;
    setReanalyzeError(null);
    setReanalyzeLoading(true);
    const toastId = toast.loading("Running AI analysis…");
    try {
      await studyService.runAiAnalysis(studyId, selectedArchitectureId);
      await queryClient.invalidateQueries({ queryKey: ["studies", "metrics", studyId] });
      await queryClient.invalidateQueries({ queryKey: ["studies"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setShowAiMesh(true);
      setMeshReloadToken((t) => t + 1);
      toast.success("AI analysis complete. Mesh and metrics were updated.", {
        id: toastId,
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "AI analysis failed.";
      setReanalyzeError(msg);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.error(msg, { id: toastId });
    } finally {
      setReanalyzeLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-0">
      {!studyId && !meshFallback && (
        <p className="px-1 text-xs text-amber-600 dark:text-amber-400">
          No study in the URL and no <code className="rounded bg-muted px-1">?mesh=</code> — add{" "}
          <code className="rounded bg-muted px-1">?studyId=</code> or open a case from{" "}
          <Link href="/upload-dicom" className="font-semibold underline-offset-4 hover:underline">
            Upload DICOM
          </Link>
          .
        </p>
      )}

      {error && (
        <p className="px-1 text-xs text-amber-600 dark:text-amber-400">
          {error} {usePlaceholder ? "(placeholder shape shown.)" : ""}
        </p>
      )}

      <div className="flex min-h-[60dvh] flex-1 flex-col gap-4 overflow-hidden rounded-xl bg-background p-3 md:min-h-[360px] md:flex-row md:gap-6 md:p-4">
        <View2DPanelLeftColumn
          files={files}
          dicomLoadStatus={dicomLoadStatus}
          dicomLoadError={dicomLoadError}
          hasDicomInDb={Boolean(studyId)}
          hasVolume={hasVolume}
          serverVolumeDepth={axialCount}
          patientName={patientName}
          studyLine={studyLine}
          studyModality={studyModality}
          windowPresets={windowPresets}
          windowPreset={windowPreset}
          windowCenter={windowCenter}
          windowWidth={windowWidth}
          denoise={denoise}
          orientation={orientation}
          onWindowPresetChange={(key, center, width) => {
            setWindowPreset(key);
            setWindowCenter(center);
            setWindowWidth(width);
          }}
          onWindowLevelChange={(center, width) => {
            setWindowCenter(center);
            setWindowWidth(width);
          }}
          onDenoiseChange={setDenoise}
          onOrientationChange={setOrientation}
          onResetSliceIndex={() => {}}
          onFolderChange={() => {}}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                3D reconstruction
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div
                className={`flex shrink-0 items-center gap-3 rounded-xl border border-graymatter-border bg-graymatter-card px-3 py-2 ${
                  !canShowVolumeStack ? "opacity-50" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">3D MRI volume</span>
                  <span className="text-xs text-muted-foreground">
                    {volumeShapeLoading
                      ? "Loading shape…"
                      : canShowVolumeStack
                        ? "Axial stack with true proportions"
                        : "Needs MRI volume on server"}
                  </span>
                </div>
                <Switch
                  checked={showVolumeStack}
                  onCheckedChange={setShowVolumeStack}
                  disabled={!canShowVolumeStack || volumeShapeLoading}
                  aria-label="Show 3D MRI volume stack"
                />
              </div>
              <div
                className={`flex shrink-0 items-center gap-3 rounded-xl border border-graymatter-border bg-graymatter-card px-3 py-2 ${
                  !studyId ? "opacity-50" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">AI brain surface</span>
                  <span className="text-xs text-muted-foreground">
                    {loading
                      ? "Checking mesh…"
                      : hasSegmentationMesh
                        ? "GLB from segmentation"
                        : "Run AI analysis (right) to enable"}
                  </span>
                </div>
                <Switch
                  checked={showAiMesh}
                  onCheckedChange={setShowAiMesh}
                  disabled={!hasSegmentationMesh || loading}
                  aria-label="Show AI brain mesh in 3D"
                />
              </div>
              <div
                className={`flex shrink-0 items-center gap-2 rounded-xl border border-graymatter-border bg-graymatter-card px-2 py-2 ${
                  !showMeshInViewer ? "opacity-60" : ""
                }`}
              >
                <span className="px-1 text-xs font-medium text-foreground">Brain style</span>
                <button
                  type="button"
                  onClick={() => setSurfaceRenderMode("semi")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    surfaceRenderMode === "semi"
                      ? "bg-sky-600 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={surfaceRenderMode === "semi"}
                  title="Transparent brain shell with colored hippocampus inside"
                >
                  Colored inside
                </button>
                <button
                  type="button"
                  onClick={() => setSurfaceRenderMode("solid")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    surfaceRenderMode === "solid"
                      ? "bg-sky-600 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={surfaceRenderMode === "solid"}
                  title="Opaque brain tissue"
                >
                  Solid brain
                </button>
              </div>
            </div>
          </div>
          {hasSegmentationMesh && showAiMesh && (
            <SegmentationClassLegend compact palette="mesh3d" className="max-w-xl" />
          )}
          {hasSegmentationMesh && showAiMesh && (
            <ClassVisibilityToggles
              visibility={classVisibility}
              onToggle={toggleClass}
              shellLabel="Brain"
            />
          )}

          {studyId && (
            <SlicerSyncPanel studyId={studyId} connected={syncConnected} />
          )}

          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-border bg-[#020617] shadow-inner md:min-h-[300px]">
            <ThreeViewer
              meshUrl={meshUrlForViewer}
              usePlaceholder={usePlaceholder}
              showMesh={showMeshInViewer}
              visualPreset={meshVisualPreset}
              classVisibility={classVisibility}
              dicomContext={dicomContext3d}
              dicomSpacingMm={dicomSpacingMm}
              dicomVoxelCount={dicomVoxelCount}
              dicomIncludeOverlay={false}
              dicomMaxStackSlices={160}
              flipVertical={flipVertical}
              onFlipVertical={() => setFlipVertical((v) => !v)}
            />
          </div>

        </div>

        <View2DPanelRightColumn
          metricGroups={metricGroups}
          metricsLoading={metricsLoading}
          reanalyzeError={reanalyzeError}
          canReanalyze={Boolean(studyId)}
          reanalyzeLoading={reanalyzeLoading}
          onRunAiAgain={onRunAiAgain}
          architectures={architectures}
          architecturesLoading={architecturesLoading}
          selectedArchitectureId={selectedArchitectureId}
          onArchitectureChange={setSelectedArchitectureId}
          activeArchitectureLabel={activeArchitectureLabel}
          viewerMode={viewerMode}
          onViewerModeChange={() => {}}
          studyId={studyId}
          patientId={patientId}
          viewContext="3d"
        />
      </div>
    </div>
  );
}

const CLASS_TOGGLE_META = (
  shellLabel: string,
): Record<MeshClassKey, { label: string; swatch: string }> => ({
  left: { label: "Left hippocampus", swatch: "bg-emerald-500" },
  right: { label: "Right hippocampus", swatch: "bg-indigo-500" },
  brain_shell: { label: shellLabel, swatch: "bg-slate-400" },
});

function ClassVisibilityToggles({
  visibility,
  onToggle,
  shellLabel,
}: {
  visibility: Required<MeshClassVisibility>;
  onToggle: (key: MeshClassKey) => void;
  shellLabel: string;
}) {
  const metaMap = CLASS_TOGGLE_META(shellLabel);
  const order: MeshClassKey[] = ["left", "right", "brain_shell"];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
      <span className="shrink-0 pr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Show classes
      </span>
      {order.map((key) => {
        const meta = metaMap[key];
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
