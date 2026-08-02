"use client";

type Props = {
  xrError: string | null;
  meshError: string | null;
  isLoading: boolean;
  studyId: string | null;
};

export function XrStatusOverlays({ xrError, meshError, isLoading, studyId }: Props) {
  return (
    <>
      {xrError && (
        <div className="absolute left-3 right-3 top-36 z-30 rounded-lg border border-amber-500/40 bg-amber-950/90 px-4 py-3 text-center text-sm text-amber-100 backdrop-blur-md sm:left-1/2 sm:right-auto sm:top-32 sm:max-w-sm sm:-translate-x-1/2">
          {xrError}
        </div>
      )}
      {meshError && (
        <div className="absolute left-3 right-3 top-28 z-30 rounded-md border border-amber-500/30 bg-amber-950/80 px-3 py-2 text-xs text-amber-200 sm:left-auto sm:right-4 sm:max-w-xs">
          {meshError}
        </div>
      )}
      {isLoading && studyId && (
        <div className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-lg bg-slate-900/90 px-5 py-4">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-500" />
          <p className="text-sm font-medium text-white">Loading…</p>
        </div>
      )}
    </>
  );
}
