"use client";

import { Html } from "@react-three/drei";

type Props = {
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onFlip: () => void;
  onResetRotation: () => void;
  onPresetLesions: () => void;
  placingLesion: boolean;
  onTogglePlacing: () => void;
  lesionCount: number;
  onClearLesions: () => void;
};

export function MeshHtmlControls({
  onRotateLeft,
  onRotateRight,
  onFlip,
  onResetRotation,
  onPresetLesions,
  placingLesion,
  onTogglePlacing,
  lesionCount,
  onClearLesions,
}: Props) {
  return (
    <Html position={[0, -0.85, 0.72]} center style={{ pointerEvents: "auto" }}>
      <div className="flex flex-col items-center gap-1 select-none">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-teal-300/90">Mesh 3D</p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onRotateLeft} className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-bold text-white hover:bg-slate-600" title="Tourner le mesh de 90° (sens antihoraire)">↺ 90°</button>
          <button type="button" onClick={onRotateRight} className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-bold text-white hover:bg-slate-600" title="Tourner le mesh de 90° (sens horaire)">↻ 90°</button>
          <button type="button" onClick={onFlip} className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-bold text-white hover:bg-slate-600" title="Retourner le mesh (180°)">⇵ 180°</button>
          <button type="button" onClick={onResetRotation} className="rounded-md bg-slate-600/80 px-2 py-1 text-[9px] font-semibold text-slate-200 hover:bg-slate-500" title="Réinitialiser l’orientation du mesh">Réinit.</button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button type="button" onClick={onPresetLesions} className="rounded-md bg-emerald-800/85 px-2 py-1 text-[9px] font-bold text-emerald-100 hover:bg-emerald-700" title="Afficher les lésions détectées par l’IA">Lésions IA</button>
          <button type="button" onClick={onTogglePlacing} className={`rounded-md px-2 py-1 text-[9px] font-bold transition-all ${placingLesion ? "bg-amber-500 text-black" : "bg-slate-700/80 text-white hover:bg-slate-600"}`} title="Cliquer sur le poumon pour placer un marqueur">
            {placingLesion ? "Clic sur poumon…" : "+ Marqueur"}
          </button>
          <button type="button" onClick={onClearLesions} disabled={lesionCount === 0} className="rounded-md bg-slate-700/80 px-2 py-1 text-[9px] font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-30">
            Effacer ({lesionCount})
          </button>
        </div>
      </div>
    </Html>
  );
}
