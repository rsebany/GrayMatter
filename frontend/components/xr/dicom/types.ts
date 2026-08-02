export type DicomSliceViewerProps = {
  studyId: string;
  maxSlices: number;
  currentSlice: number;
  onSliceChange: (slice: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPausePlayback: () => void;
  anchorPosition?: [number, number, number];
  layoutPosition?: [number, number, number];
  sceneVariant?: "vr" | "ar";
};
