"use client";

import type { RefObject } from "react";
import * as THREE from "three";
import { XR_SIDE_BY_SIDE } from "@/lib/xr/layout-constants";
import { DicomSliceViewer } from "../dicom";
import type { ArQualityPreset } from "../experience/types";
import { ImmersiveSceneControls } from "./ImmersiveSceneControls";
import { MeshGroupContent } from "./MeshGroupContent";
import type { MeshClassVisibility } from "./types";

type Props = {
  meshGroupRef: RefObject<THREE.Group | null>;
  meshUrl: string;
  useMeshPlaceholder: boolean;
  solidBrainEnabled: boolean;
  meshGroupPosition: [number, number, number];
  meshScale: number;
  meshDisplayRotation: [number, number, number];
  classVisibility: MeshClassVisibility;
  showImmersive3DControls: boolean;
  useHtmlControls: boolean;
  isPresenting: boolean;
  isArImmersive: boolean;
  arQuality: ArQualityPreset;
  hideHeavyArAssets: boolean;
  studyId: string | null;
  dicomSliceCount: number;
  currentDicomSlice: number;
  onDicomSliceChange: (slice: number) => void;
  isDicomPlaying: boolean;
  onToggleDicomPlay: () => void;
  onPauseDicomPlay: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPresetAll: () => void;
  onPresetLesions: () => void;
  onPresetShell: () => void;
  onToggleMeshClass: (key: keyof MeshClassVisibility) => void;
  onArQualityChange: (next: ArQualityPreset) => void;
  onToggleSolidBrain: () => void;
  onCenterAr: () => void;
  rotateMeshY: (d: 1 | -1) => void;
  resetMeshRotation: () => void;
  flipMesh: () => void;
  onAddPanel: () => void;
  onClearPanels: () => void;
  placingLesion: boolean;
  setPlacingLesion: (v: boolean | ((prev: boolean) => boolean)) => void;
  userLesions: Array<{ id: string; position: [number, number, number] }>;
  onClearLesions: () => void;
  onSurfacePick: (worldPoint: THREE.Vector3) => void;
};

export function ClinicalZoneContent(props: Props) {
  const { showImmersive3DControls, hideHeavyArAssets, studyId, dicomSliceCount, ...mesh } = props;

  return (
    <>
      {showImmersive3DControls ? (
        <ImmersiveSceneControls
          classVisibility={props.classVisibility}
          onZoomIn={props.onZoomIn}
          onZoomOut={props.onZoomOut}
          onPresetAll={props.onPresetAll}
          onPresetLesions={props.onPresetLesions}
          onPresetShell={props.onPresetShell}
          onToggleMeshClass={props.onToggleMeshClass}
          isArImmersive={props.isArImmersive}
          arQuality={props.arQuality}
          onArQualityChange={props.onArQualityChange}
          solidBrainEnabled={props.solidBrainEnabled}
          onToggleSolidBrain={props.onToggleSolidBrain}
          onCenterAr={props.onCenterAr}
        />
      ) : null}
      <MeshGroupContent {...mesh} classVisibility={props.classVisibility} />
      {studyId && dicomSliceCount > 0 && !hideHeavyArAssets ? (
        <DicomSliceViewer
          studyId={studyId}
          maxSlices={dicomSliceCount}
          currentSlice={props.currentDicomSlice}
          onSliceChange={props.onDicomSliceChange}
          isPlaying={props.isDicomPlaying}
          onTogglePlay={props.onToggleDicomPlay}
          onPausePlayback={props.onPauseDicomPlay}
          layoutPosition={[...XR_SIDE_BY_SIDE.dicom]}
        />
      ) : null}
    </>
  );
}
