"use client";

export function DicomRotationButtons({
  onRotateLeft,
  onRotateRight,
  onReset,
}: {
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onRotateLeft} className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-bold text-white hover:bg-slate-600" title="Tourner la coupe de 90° (sens antihoraire)">
        ↺ 90°
      </button>
      <button type="button" onClick={onRotateRight} className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-bold text-white hover:bg-slate-600" title="Tourner la coupe de 90° (sens horaire)">
        ↻ 90°
      </button>
      <button type="button" onClick={onReset} className="rounded-md bg-slate-600/80 px-2 py-1 text-[9px] font-semibold text-slate-200 hover:bg-slate-500" title="Réinitialiser l’orientation de la coupe">
        Réinit.
      </button>
    </div>
  );
}
