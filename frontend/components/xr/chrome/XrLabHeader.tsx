"use client";

import { AppLogo } from "@/components/layout/app-logo";
import { XrPipelineQuickLinks } from "@/components/features/viewer/pipeline/XrPipelineQuickLinks";

type Props = {
  studyId: string | null;
  syncConnected: boolean;
};

export function XrLabHeader({ studyId, syncConnected }: Props) {
  return (
    <div className="pointer-events-auto flex w-full max-w-full flex-col gap-1.5 sm:max-w-[18rem]">
      <div
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/85 px-2.5 py-1.5 backdrop-blur-md"
        title={studyId ? `Study ${studyId}` : undefined}
      >
        <AppLogo size={24} className="h-6 w-6 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">GrayMatter</p>
        </div>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${syncConnected ? "bg-emerald-400" : "bg-amber-400"}`}
          title={syncConnected ? "Sync on" : "Sync off"}
          aria-label={syncConnected ? "Live sync on" : "Live sync off"}
        />
      </div>

      <details className="rounded-lg border border-white/10 bg-slate-900/70 text-slate-300 backdrop-blur-md open:bg-slate-900/85">
        <summary className="cursor-pointer list-none px-2.5 py-1.5 text-xs font-medium text-slate-400 marker:hidden [&::-webkit-details-marker]:hidden">
          Links
        </summary>
        <div className="border-t border-white/10 px-2 pb-2 pt-1">
          <XrPipelineQuickLinks variant="navigationOnly" />
        </div>
      </details>
    </div>
  );
}
