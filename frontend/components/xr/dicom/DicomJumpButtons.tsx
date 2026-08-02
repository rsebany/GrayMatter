"use client";

export function DicomJumpButtons({
  maxSlices,
  onPause,
  onJump,
}: {
  maxSlices: number;
  onPause: () => void;
  onJump: (slice: number) => void;
}) {
  const jump = (slice: number) => {
    onPause();
    onJump(slice);
  };
  const btn = "rounded-md bg-slate-700/80 px-2.5 py-1 text-[9px] font-bold text-white hover:bg-slate-600";
  return (
    <div className="flex gap-1.5">
      <button type="button" onClick={() => jump(0)} className={btn}>First</button>
      <button type="button" onClick={() => jump(Math.floor(maxSlices / 2))} className={btn}>Middle</button>
      <button type="button" onClick={() => jump(maxSlices - 1)} className={btn}>Last</button>
    </div>
  );
}
