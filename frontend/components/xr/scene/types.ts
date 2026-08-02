import type { ArQualityPreset } from "../experience/types";

export type MeshClassVisibility = {
  left: boolean;
  right: boolean;
  brain_shell: boolean;
};

export type XRSceneContentProps = {
  meshUrl: string;
  useMeshPlaceholder: boolean;
  solidBrainEnabled?: boolean;
  onToggleSolidBrain?: () => void;
  onResetView: () => void;
  studyId: string | null;
  dicomSliceCount: number;
  currentDicomSlice: number;
  onDicomSliceChange: (slice: number) => void;
  focusStackNonce: number;
  focusMeshNonce: number;
  focusBalancedNonce: number;
  meshScale: number;
  classVisibility: MeshClassVisibility;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPresetAll: () => void;
  onPresetLesions: () => void;
  onPresetShell: () => void;
  onToggleMeshClass: (key: keyof MeshClassVisibility) => void;
  sceneVariant?: "vr" | "ar";
  arQuality?: ArQualityPreset;
  arPerformanceMode?: boolean;
  onArQualityChange: (next: ArQualityPreset) => void;
  syncConnected: boolean;
  isDicomPlaying: boolean;
  onToggleDicomPlay: () => void;
  onPauseDicomPlay: () => void;
  vrSpawnNonce?: number;
};
