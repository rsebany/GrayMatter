"use client";

type Props = {
  noSegmentationMessage: string | null;
  showAnalysisComplete: boolean;
};

export function UploadIntakeNotifications({
  noSegmentationMessage,
  showAnalysisComplete,
}: Props) {
  return (
    <>
      {noSegmentationMessage && (
        <div className="safe-bottom fixed bottom-2 left-3 right-3 z-40 max-w-sm animate-in slide-in-from-right-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-500 shadow-lg sm:bottom-6 sm:left-auto sm:right-6">
          {noSegmentationMessage}
        </div>
      )}

      {showAnalysisComplete && (
        <div className="safe-bottom fixed bottom-2 left-3 right-3 z-40 max-w-sm animate-in slide-in-from-right-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-500 shadow-lg sm:bottom-6 sm:left-auto sm:right-6">
          ✓ Analysis complete — choose a viewer or download the report
        </div>
      )}
    </>
  );
}
