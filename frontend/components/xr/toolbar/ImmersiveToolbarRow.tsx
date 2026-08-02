"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { XrImmersiveToolbarMode } from "./types";

type Props = {
  immersiveMode: XrImmersiveToolbarMode;
  isImmersiveSupported: boolean;
  isCheckingSupport?: boolean;
  onEnterImmersiveCentered: () => void | Promise<void>;
  onToggleFullscreen?: () => void;
  alternateLabHref: string;
  alternateLabShortLabel: string;
};

export function ImmersiveToolbarRow({
  immersiveMode,
  isImmersiveSupported,
  isCheckingSupport = false,
  onEnterImmersiveCentered,
  onToggleFullscreen,
  alternateLabHref,
  alternateLabShortLabel,
}: Props) {
  const enterLabel = immersiveMode === "ar" ? "Enter AR" : "Enter VR";
  const primaryBtn =
    "h-10 shrink-0 rounded-full bg-sky-600 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-500 sm:h-11 flex-1";

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-center">
      <div className="flex w-full max-w-xs gap-2 sm:flex-1">
        {isImmersiveSupported ? (
          <Button type="button" onClick={() => void onEnterImmersiveCentered()} disabled={isCheckingSupport} className={primaryBtn}>
            {isCheckingSupport ? "Checking…" : enterLabel}
          </Button>
        ) : (
          <Button type="button" asChild className={primaryBtn}>
            <Link href={alternateLabHref} prefetch>
              Open {alternateLabShortLabel}
            </Link>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleFullscreen}
          className="h-10 w-24 shrink-0 border-white/20 bg-slate-950/50 text-xs text-slate-200 hover:bg-slate-900/80 sm:h-11"
        >
          Plein écran
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        asChild
        className={cn(
          "h-10 w-full max-w-xs shrink-0 border-white/20 bg-slate-950/50 text-xs text-slate-200 hover:bg-slate-900/80 sm:h-11 sm:flex-1",
        )}
      >
        <Link href={alternateLabHref} prefetch>
          {alternateLabShortLabel} lab
        </Link>
      </Button>
    </div>
  );
}

export function ImmersiveUnsupportedNote({
  immersiveMode,
  isImmersiveSupported,
  isCheckingSupport,
}: {
  immersiveMode: XrImmersiveToolbarMode;
  isImmersiveSupported: boolean;
  isCheckingSupport?: boolean;
}) {
  if (isImmersiveSupported) return null;
  return (
    <p
      className="max-w-[14rem] text-center text-[10px] leading-snug text-amber-400/90"
      title={
        immersiveMode === "ar"
          ? "AR needs an AR-capable Android Chrome browser and HTTPS."
          : "Connect a WebXR headset or use desktop view."
      }
    >
      {isCheckingSupport
        ? "Checking XR support…"
        : immersiveMode === "ar"
          ? "AR not available on this browser. Open on an AR-capable Android phone over HTTPS, or switch to VR."
          : "Immersive not available in this browser."}
    </p>
  );
}
