"use client";

import React, { useEffect, useState, useMemo } from "react";
import { AlertCircle, Play, Pause } from "lucide-react";
import { getStudySliceUrl } from "@/api/clients";
import { cn } from "@/lib/utils";

type Props = {
  studyId: string | null;
  files: File[] | null;
  windowCenter: number;
  windowWidth: number;
  denoise: boolean;
  showOverlay: boolean;
  setShowOverlay: (value: boolean) => void;
  overlayOpacity: number;
  setOverlayOpacity: (value: number) => void;
  orientation: "axial" | "coronal" | "sagittal";
  sliceIndex: number;
  setSliceIndex: React.Dispatch<React.SetStateAction<number>>;
  segmentationMask: Uint8Array[] | null;
  maskShape: [number, number, number] | null;
  dicomLoadStatus: "idle" | "loading" | "loaded" | "failed";
  dicomLoadError: string | null;
  maskLoadError: string | null;
  overlayImageError: boolean;
  setOverlayImageError: (value: boolean) => void;
  viewerMode: "png" | "dicom3d";
  metricsError: string | null;
  meshUrl: string | null;
  meshLoading: boolean;
  volumeDepth: number;
  maskAvailable: boolean;
};

export function View2DPanelCenterColumn({
  studyId,
  files,
  windowCenter,
  windowWidth,
  denoise,
  showOverlay,
  setShowOverlay,
  overlayOpacity,
  setOverlayOpacity,
  orientation,
  sliceIndex,
  setSliceIndex,
  segmentationMask,
  maskShape,
  dicomLoadStatus,
  maskLoadError,
  overlayImageError,
  setOverlayImageError,
  viewerMode,
  volumeDepth,
  maskAvailable,
}: Props) {
  const CINE_INTERVAL_MS = 180;
  const [pngAutoPlay, setPngAutoPlay] = useState(false);
  const [maskStats, setMaskStats] = useState<{ count: number; percentage: number } | null>(null);
  const [visibleSliceUrl, setVisibleSliceUrl] = useState<string | null>(null);

  // Use volumeDepth passed from parent (accounts for orientation)
  const currentDepth = volumeDepth;
  const safeSliceIndex = Math.max(0, Math.min(sliceIndex, Math.max(currentDepth - 1, 0)));

  // 2. PNG MODE URLS
  // Backend provides /studies/{id}/slices/{z} endpoint with windowing and orientation support
  const clampedOverlayAlpha = Math.max(0, Math.min(1, overlayOpacity));
  const requestOverlay = showOverlay && maskAvailable;
  const pngSliceUrl = useMemo(() => {
    if (!studyId || safeSliceIndex < 0) return null;
    return getStudySliceUrl(studyId, safeSliceIndex, {
      windowCenter,
      windowWidth,
      orientation,
      includeOverlay: requestOverlay,
      overlayOpacity: clampedOverlayAlpha,
      denoise,
    });
  }, [
    studyId,
    safeSliceIndex,
    windowCenter,
    windowWidth,
    orientation,
    requestOverlay,
    clampedOverlayAlpha,
    denoise,
  ]);

  // Cine-loop for PNG Mode (functional updater so the interval is not recreated every slice)
  useEffect(() => {
    if (!pngAutoPlay || currentDepth <= 1 || viewerMode !== "png") return;
    const id = window.setInterval(() => {
      setSliceIndex((prev) => {
        const maxIdx = Math.max(currentDepth - 1, 0);
        const clamped = Math.min(Math.max(0, prev), maxIdx);
        return (clamped + 1) % currentDepth;
      });
    }, CINE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pngAutoPlay, currentDepth, setSliceIndex, viewerMode, CINE_INTERVAL_MS]);

  // Keep previous loaded frame visible while preloading the next one.
  useEffect(() => {
    if (!pngSliceUrl || !studyId) {
      setVisibleSliceUrl(null);
      if (!pngSliceUrl) setOverlayImageError(false);
      return;
    }

    let cancelled = false;

    const loadImage = (url: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("slice load failed"));
        img.src = url;
      });

    const run = async () => {
      setOverlayImageError(false);
      try {
        await loadImage(pngSliceUrl);
        if (cancelled) return;
        setVisibleSliceUrl(pngSliceUrl);
      } catch {
        if (cancelled) return;
        if (requestOverlay) {
          const fallbackUrl = getStudySliceUrl(studyId, safeSliceIndex, {
            windowCenter,
            windowWidth,
            orientation,
            includeOverlay: false,
            denoise,
          });
          try {
            await loadImage(fallbackUrl);
            if (cancelled) return;
            setVisibleSliceUrl(fallbackUrl);
            setOverlayImageError(false);
            return;
          } catch {
            // fall through to error state
          }
        }
        setOverlayImageError(true);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    pngSliceUrl,
    studyId,
    safeSliceIndex,
    windowCenter,
    windowWidth,
    orientation,
    requestOverlay,
    denoise,
    setOverlayImageError,
  ]);

  // Calculate mask statistics for current slice
  useEffect(() => {
    if (!segmentationMask || segmentationMask.length === 0 || safeSliceIndex >= segmentationMask.length) {
      setMaskStats(null);
      return;
    }
    const slice = segmentationMask[safeSliceIndex];
    if (!slice) {
      setMaskStats(null);
      return;
    }
    let count = 0;
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] > 0) count++;
    }
    const percentage = (count / slice.length) * 100;
    setMaskStats({ count, percentage });
  }, [segmentationMask, safeSliceIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle overlay with 'O' key
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setShowOverlay(!showOverlay);
      }
      // Navigate slices with arrow keys
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSliceIndex(Math.max(0, safeSliceIndex - 1));
      }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSliceIndex(Math.min(currentDepth - 1, safeSliceIndex + 1));
      }
      // Jump to first/last slice with Home/End
      else if (e.key === 'Home') {
        e.preventDefault();
        setSliceIndex(0);
      }
      else if (e.key === 'End') {
        e.preventDefault();
        setSliceIndex(currentDepth - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showOverlay, setShowOverlay, safeSliceIndex, currentDepth, setSliceIndex]);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-graymatter-border bg-black shadow-2xl">
      
      {/* HUD: Diagnostic Metadata */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-5">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-300 font-mono tracking-tight uppercase">
            {orientation} • SLICE {safeSliceIndex + 1} / {currentDepth}
          </span>
          {/* Hippocampus coverage for current slice */}
          {showOverlay && maskStats && maskStats.count > 0 && viewerMode === "dicom3d" && (
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1 w-1 rounded-full bg-red-500" />
              <span className="text-[9px] text-red-400 font-mono">
                Hippocampus: {maskStats.percentage.toFixed(1)}% ({maskStats.count} px)
              </span>
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
          <div className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 backdrop-blur-xl sm:gap-3 sm:px-4 sm:py-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Overlay</span>
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className={cn(
                  "relative h-5 w-10 rounded-full transition-all duration-300 ease-in-out",
                  showOverlay ? "bg-red-500" : "bg-slate-700"
                )}
              >
                <div className={cn(
                  "absolute top-1 h-3 w-3 rounded-full bg-white transition-all duration-300",
                  showOverlay ? "left-6" : "left-1"
                )} />
              </button>
              {showOverlay && (
                <div className="ml-1 flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">α</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={clampedOverlayAlpha}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    aria-label="Overlay opacity"
                    className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-slate-700 sm:w-24 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500"
                  />
                  <span className="w-8 text-right font-mono text-xs text-slate-300">
                    {Math.round(clampedOverlayAlpha * 100)}%
                  </span>
                </div>
              )}
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-2 bg-black/95 rounded-lg text-[8px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
                <div className="font-bold text-white/90 mb-1">Keyboard Shortcuts:</div>
                <div>O - Toggle overlay</div>
                <div>← → ↑ ↓ - Navigate slices</div>
                <div>Home/End - First/Last slice</div>
              </div>
          </div>
        </div>
      </div>

      {/* VIEWPORT CONTENT */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-black">
        
        {/* PNG Mode - Always Active */}
        <div className="relative w-full h-full flex items-center justify-center p-2">
          {pngSliceUrl ? (
            <>
              {/* PNG slice with baked-in red overlay from backend */}
              {visibleSliceUrl ? (
                <img
                  src={visibleSliceUrl}
                  alt={`DICOM Slice ${safeSliceIndex + 1}`}
                  className="w-full h-full object-contain rounded-sm select-none shadow-2xl"
                  style={{ imageRendering: "auto" }}
                />
              ) : overlayImageError ? (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <AlertCircle className="h-10 w-10 text-amber-500" />
                  <p className="max-w-xs text-center text-[10px] uppercase tracking-[0.15em]">
                    Could not load slice — check study volume on server
                  </p>
                </div>
              ) : (
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Loading slice...
                </div>
              )}
              
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <AlertCircle className="h-12 w-12" />
              <p className="text-[10px] uppercase tracking-[0.3em]">No Preview Available</p>
            </div>
          )}

          {/* Cine Controls */}
          <div className="absolute bottom-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 backdrop-blur-md opacity-60 transition-opacity hover:opacity-100 sm:bottom-10 sm:gap-4 sm:px-6 sm:py-3 sm:opacity-40">
              <button 
                onClick={() => setPngAutoPlay(!pngAutoPlay)}
                className="flex items-center gap-2 text-[11px] font-bold text-white uppercase tracking-widest"
              >
                {pngAutoPlay ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                {pngAutoPlay ? "Pause" : "Play"}
              </button>
              <div className="h-4 w-[1px] bg-white/10" />
              <span className="text-xs font-mono text-slate-300">
                {Math.round(1000 / CINE_INTERVAL_MS)} FPS
              </span>
          </div>
        </div>

        {/* Slice Range Slider - Universal control for both modes */}
        {currentDepth > 1 && (
          <div className="w-full bg-gradient-to-t from-black/80 to-transparent px-3 py-3 sm:px-8 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setSliceIndex(Math.max(0, safeSliceIndex - 1))}
                disabled={safeSliceIndex === 0}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="range"
                  min="0"
                  max={currentDepth - 1}
                  value={safeSliceIndex}
                  onChange={(e) => setSliceIndex(parseInt(e.target.value))}
                  onInput={(e) => setSliceIndex(parseInt((e.target as HTMLInputElement).value))}
                  className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:border-0"
                  style={{
                    background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${(safeSliceIndex / (currentDepth - 1)) * 100}%, rgb(30 41 59) ${(safeSliceIndex / (currentDepth - 1)) * 100}%, rgb(30 41 59) 100%)`
                  }}
                />
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-mono text-slate-400">1</span>
                  <span className="text-[11px] font-bold text-white font-mono">
                    Slice {safeSliceIndex + 1} / {currentDepth}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{currentDepth}</span>
                </div>
              </div>

              <button
                onClick={() => setSliceIndex(Math.min(currentDepth - 1, safeSliceIndex + 1))}
                disabled={safeSliceIndex === currentDepth - 1}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ERROR OVERLAY */}
      {maskLoadError && (
        <div className="absolute bottom-6 left-6 right-6 z-40">
          <div className="flex items-center gap-4 rounded-xl border border-red-500/20 bg-red-950/40 p-4 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-widest text-red-400">Segmentation Fault</span>
                <p className="text-[11px] text-red-200/60 font-mono">{maskLoadError}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}