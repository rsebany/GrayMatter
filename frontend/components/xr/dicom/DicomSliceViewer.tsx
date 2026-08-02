"use client";

import { Interactive, useXR } from "@react-three/xr";
import { DicomHtmlControls } from "./DicomHtmlControls";
import { DicomImmersiveControls } from "./DicomImmersiveControls";
import { DicomSliceLoadingState } from "./DicomSliceLoadingState";
import { DicomSlicePlane } from "./DicomSlicePlane";
import type { DicomSliceViewerProps } from "./types";
import { useDicomSliceTextures } from "./use-dicom-slice-textures";
import { useSliceInteraction } from "./use-slice-interaction";

export function DicomSliceViewer({
  studyId,
  maxSlices,
  currentSlice,
  onSliceChange,
  isPlaying,
  onTogglePlay,
  onPausePlayback,
  anchorPosition,
  layoutPosition,
}: DicomSliceViewerProps) {
  const xr = useXR();
  const isPresenting = Boolean(xr.session);
  const useImmersiveControls = isPresenting;
  const useHtmlControls = !isPresenting;

  const { texture, loading } = useDicomSliceTextures(studyId, maxSlices, currentSlice);
  const {
    isDragging,
    position,
    planeRotation,
    handlePrevSlice,
    handleNextSlice,
    rotatePlaneY,
    resetPlaneRotation,
    updateSlice,
    onSlicePointerDown,
    onSlicePointerMove,
    onSlicePointerUp,
    setIsDragging,
    clearDrag: clearSliceDrag,
  } = useSliceInteraction({
    maxSlices,
    currentSlice,
    onSliceChange,
    onPausePlayback,
    layoutPosition,
    anchorPosition,
  });

  if (loading && !texture) {
    return <DicomSliceLoadingState position={position} useImmersive={useImmersiveControls} />;
  }

  return (
    <Interactive
      onSelectStart={() => setIsDragging(true)}
      onSelectEnd={() => {
        clearSliceDrag();
        setIsDragging(false);
      }}
    >
      <group position={position}>
        {texture ? (
          <DicomSlicePlane
            texture={texture}
            planeRotation={planeRotation}
            isDragging={isDragging}
            showScrubHint={useHtmlControls}
            onPointerDown={onSlicePointerDown}
            onPointerMove={onSlicePointerMove}
            onPointerUp={onSlicePointerUp}
          />
        ) : null}

        {useImmersiveControls ? (
          <DicomImmersiveControls
            currentSlice={currentSlice}
            maxSlices={maxSlices}
            isPlaying={isPlaying}
            onPrev={handlePrevSlice}
            onTogglePlay={onTogglePlay}
            onNext={handleNextSlice}
            onRotateLeft={() => rotatePlaneY(-1)}
            onRotateRight={() => rotatePlaneY(1)}
            onResetRotation={resetPlaneRotation}
          />
        ) : null}

        {useHtmlControls ? (
          <DicomHtmlControls
            currentSlice={currentSlice}
            maxSlices={maxSlices}
            isPlaying={isPlaying}
            onPrev={handlePrevSlice}
            onTogglePlay={onTogglePlay}
            onNext={handleNextSlice}
            onSliceChange={updateSlice}
            onPausePlayback={onPausePlayback}
            onRotateLeft={() => rotatePlaneY(-1)}
            onRotateRight={() => rotatePlaneY(1)}
            onResetRotation={resetPlaneRotation}
          />
        ) : null}
      </group>
    </Interactive>
  );
}
