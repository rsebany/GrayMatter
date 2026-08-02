"use client";

import { Html } from "@react-three/drei";
import { DicomJumpButtons } from "./DicomJumpButtons";
import { DicomNavButton } from "./DicomNavButton";
import { DicomRotationButtons } from "./DicomRotationButtons";

type Props = {
  currentSlice: number;
  maxSlices: number;
  isPlaying: boolean;
  onPrev: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onSliceChange: (slice: number) => void;
  onPausePlayback: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onResetRotation: () => void;
};

export function DicomHtmlControls(props: Props) {
  const {
    currentSlice, maxSlices, isPlaying, onPrev, onTogglePlay, onNext,
    onSliceChange, onPausePlayback, onRotateLeft, onRotateRight, onResetRotation,
  } = props;
  const maxIndex = Math.max(maxSlices - 1, 0);
  const progress = (currentSlice / Math.max(maxSlices - 1, 1)) * 100;

  return (
    <Html position={[0, -0.85, 0]} center style={{ pointerEvents: "auto" }}>
      <div className="flex flex-col items-center gap-2 select-none">
        <div className="rounded-full border border-blue-500/40 bg-blue-950/95 px-3 py-1 backdrop-blur-md">
          <p className="text-[11px] font-semibold tabular-nums text-blue-200">
            {currentSlice + 1} / {maxSlices}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DicomNavButton onClick={onPrev} disabled={currentSlice === 0} direction="prev" />
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={maxSlices <= 1}
            className="rounded-full bg-cyan-600/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg transition-all hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={currentSlice}
            onChange={(e) => {
              onPausePlayback();
              onSliceChange(parseInt(e.target.value, 10));
            }}
            className="h-2 w-40 cursor-pointer appearance-none rounded-full bg-slate-700 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-500"
            style={{
              background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${progress}%, rgb(51 65 85) ${progress}%, rgb(51 65 85) 100%)`,
            }}
          />
          <DicomNavButton onClick={onNext} disabled={currentSlice === maxSlices - 1} direction="next" />
        </div>
        <DicomRotationButtons onRotateLeft={onRotateLeft} onRotateRight={onRotateRight} onReset={onResetRotation} />
        <DicomJumpButtons maxSlices={maxSlices} onPause={onPausePlayback} onJump={onSliceChange} />
      </div>
    </Html>
  );
}
