"use client";

import type { XrExperienceMode } from "../experience/types";

type Props = {
  mode: XrExperienceMode;
  onExit: () => void;
};

export function XrImmersiveHud({ mode, onExit }: Props) {
  const label = mode === "ar" ? "Exit AR" : "Exit VR";

  return (
    <div className="safe-top pointer-events-auto absolute left-3 top-[calc(var(--safe-area-top)+0.75rem)] z-30 sm:left-4">
      <button
        type="button"
        onClick={onExit}
        className="rounded-full border border-white/20 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg backdrop-blur-md transition hover:bg-slate-900/90 active:scale-95"
        aria-label={label}
      >
        {label}
      </button>
    </div>
  );
}
