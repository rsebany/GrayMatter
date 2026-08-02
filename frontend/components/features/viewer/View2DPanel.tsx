"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { studyService, type DicomVolumeShape } from "@/services/study";
import { useVolumeDisplayUnit } from "@/hooks/settings";
import {
  useDicomLoader,
  useMaskProcessor,
  useResolvedStudyId,
  useViewerCaseContext,
} from "@/hooks/viewer";
import { useStudiesList, useStudyMetrics, useArchitectureSelection } from "@/hooks/studies";
import { buildSegmentationMetricGroups } from "@/lib/metrics/segmentation-metric-groups";
import {
  defaultWindowPresetKey,
  windowPresetsForModality,
} from "@/lib/viewer/window-presets";

// View Sub-components
import { View2DPanelLeftColumn } from "@/components/features/viewer/view2d/View2DPanelLeftColumn";
import { View2DPanelCenterColumn } from "@/components/features/viewer/view2d/View2DPanelCenterColumn";
import { View2DPanelRightColumn } from "@/components/features/viewer/view2d/View2DPanelRightColumn";
import { SegmentationClassLegend } from "@/components/features/viewer/ui/SegmentationClassLegend";

type Orientation = "axial" | "coronal" | "sagittal";

export function View2DPanel() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const patientId = searchParams.get("patientId") ?? "";
  const studyIdParam = searchParams.get("studyId");
  const studyId = useResolvedStudyId({
    studyIdParam,
    patientId: patientId || null,
  });

  const { data: studies } = useStudiesList();
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

  // --- 1. VIEWPORT STATE ---
  const [windowPreset, setWindowPreset] = useState(defaultPresetKey);
  const [windowCenter, setWindowCenter] = useState(defaultPreset.center);
  const [windowWidth, setWindowWidth] = useState(defaultPreset.width);
  const [denoise, setDenoise] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.7);
  const [orientation, setOrientation] = useState<Orientation>("axial");
  const [sliceIndex, setSliceIndex] = useState(0);
  const [viewerMode] = useState<"png">("png");

  useEffect(() => {
    const preset = windowPresets[defaultPresetKey];
    setWindowPreset(defaultPresetKey);
    setWindowCenter(preset.center);
    setWindowWidth(preset.width);
  }, [studyId, studyModality, defaultPresetKey, windowPresets]);

  // DICOM & Mask Data Hooks
  const { files, status: dicomLoadStatus, error: dicomLoadError } = useDicomLoader(studyId, Boolean(studyId));
  const { data: metrics, isLoading: metricsLoading } = useStudyMetrics(studyId || undefined);
  const {
    architectures,
    architecturesLoading,
    selectedArchitectureId,
    setSelectedArchitectureId,
    activeArchitectureLabel,
  } = useArchitectureSelection(metrics);
  const { patientName, studyLine } = useViewerCaseContext(studyId, patientId || null);

  const [rawMask, setRawMask] = useState<Uint8Array | null>(null);
  const [rawMaskShape, setRawMaskShape] = useState<[number, number, number] | null>(null);
  const [maskLoadError, setMaskLoadError] = useState<string | null>(null);

  const { slices: segmentationMask, shape: maskShape, maxDiseaseSliceIndex } = useMaskProcessor(rawMask, rawMaskShape);

  const [overlayImageError, setOverlayImageError] = useState(false);
  const [reanalyzeLoading, setReanalyzeLoading] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
  const [maskReloadToken, setMaskReloadToken] = useState(0);
  const [serverVolumeShape, setServerVolumeShape] = useState<DicomVolumeShape | null>(null);

  useEffect(() => {
    if (!studyId) {
      setServerVolumeShape(null);
      return;
    }
    let cancelled = false;
    studyService
      .getDicomVolumeShape(studyId)
      .then((shape) => {
        if (!cancelled) setServerVolumeShape(shape);
      })
      .catch(() => {
        if (!cancelled) setServerVolumeShape(null);
      });
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  const volumeDepth = useMemo(() => {
    const serverD = serverVolumeShape?.depth ?? 0;
    const fileCount = files?.length ?? 0;
    const maskD = maskShape?.[0] ?? 0;

    if (orientation === "axial") {
      if (serverD > 0) return serverD;
      if (fileCount > 0) return fileCount;
      if (maskD > 0) return maskD;
      return 0;
    }
    if (orientation === "coronal" || orientation === "sagittal") {
      if (maskShape) {
        if (orientation === "coronal") return maskShape[1];
        return maskShape[2];
      }
      if (serverVolumeShape) {
        if (orientation === "coronal") return serverVolumeShape.height;
        return serverVolumeShape.width;
      }
      return 512;
    }
    return 0;
  }, [files, orientation, maskShape, serverVolumeShape]);

  useEffect(() => {
    if (sliceIndex >= volumeDepth) {
      setSliceIndex(Math.floor(volumeDepth / 2));
    }
  }, [orientation, volumeDepth]);

  useEffect(() => {
    if (maxDiseaseSliceIndex != null && maxDiseaseSliceIndex >= 0) {
      setSliceIndex(maxDiseaseSliceIndex);
    } else if (files && files.length > 0) {
      setSliceIndex(Math.floor(files.length / 2));
    }
  }, [maxDiseaseSliceIndex, files?.length]);

  useEffect(() => {
    if (!studyId) return;
    setMaskLoadError(null);
    studyService
      .getMask(studyId)
      .then(({ shape, data }) => {
        setRawMask(data);
        setRawMaskShape(shape as [number, number, number]);
      })
      .catch((err) => setMaskLoadError(String(err?.message ?? err)));
  }, [studyId, maskReloadToken]);

  const volumeDisplayUnit = useVolumeDisplayUnit();
  const metricGroups = useMemo(
    () => buildSegmentationMetricGroups(metrics, volumeDisplayUnit),
    [metrics, volumeDisplayUnit],
  );

  const hasVolume = Boolean(
    (files && files.length > 0) || (serverVolumeShape?.depth ?? 0) > 0,
  );
  const serverVolumeDepth = serverVolumeShape?.depth ?? 0;
  const hasMask = Boolean(
    (rawMaskShape?.[0] ?? 0) > 0 && (rawMask?.length ?? 0) > 0,
  );

  const onRunAiAgain = async () => {
    if (!studyId || !selectedArchitectureId) return;
    setReanalyzeError(null);
    setReanalyzeLoading(true);
    const toastId = toast.loading("Running AI analysis…");
    try {
      await studyService.runAiAnalysis(studyId, selectedArchitectureId);
      await queryClient.invalidateQueries({
        queryKey: ["studies", "metrics", studyId],
      });
      await queryClient.invalidateQueries({ queryKey: ["studies"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setMaskReloadToken((t) => t + 1);
      toast.success("AI analysis complete. Mask and metrics were updated.", {
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <SegmentationClassLegend compact />
      <div className="flex min-h-[60dvh] flex-1 flex-col gap-4 overflow-hidden rounded-xl bg-background p-3 md:min-h-[420px] md:flex-row md:gap-6 md:p-4">
        <View2DPanelLeftColumn
          files={files}
          dicomLoadStatus={dicomLoadStatus}
          dicomLoadError={dicomLoadError}
          hasDicomInDb={Boolean(studyId)}
          hasVolume={hasVolume}
          serverVolumeDepth={serverVolumeDepth}
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
          onResetSliceIndex={() => setSliceIndex(0)}
          onFolderChange={() => {}}
        />

        <View2DPanelCenterColumn
          studyId={studyId}
          files={files}
          windowCenter={windowCenter}
          windowWidth={windowWidth}
          denoise={denoise}
          showOverlay={showOverlay}
          setShowOverlay={setShowOverlay}
          overlayOpacity={overlayOpacity}
          setOverlayOpacity={setOverlayOpacity}
          orientation={orientation}
          sliceIndex={sliceIndex}
          setSliceIndex={setSliceIndex}
          segmentationMask={segmentationMask}
          maskShape={maskShape}
          dicomLoadStatus={dicomLoadStatus}
          viewerMode={viewerMode}
          maskLoadError={maskLoadError}
          overlayImageError={overlayImageError}
          setOverlayImageError={setOverlayImageError}
          dicomLoadError={null}
          metricsError={null}
          meshUrl={null}
          meshLoading={false}
          volumeDepth={volumeDepth}
          maskAvailable={hasMask}
        />

        <View2DPanelRightColumn
          metricGroups={metricGroups}
          metricsLoading={metricsLoading}
          reanalyzeLoading={reanalyzeLoading}
          canReanalyze={Boolean(studyId)}
          onRunAiAgain={onRunAiAgain}
          architectures={architectures}
          architecturesLoading={architecturesLoading}
          selectedArchitectureId={selectedArchitectureId}
          onArchitectureChange={setSelectedArchitectureId}
          activeArchitectureLabel={activeArchitectureLabel}
          viewerMode={viewerMode}
          onViewerModeChange={() => {}}
          reanalyzeError={reanalyzeError}
          studyId={studyId}
          patientId={patientId}
          viewContext="2d"
        />
      </div>
    </div>
  );
}
