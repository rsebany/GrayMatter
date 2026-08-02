"use client";

import { cn } from "@/lib/utils";
import { CameraToolbarGroup } from "./CameraToolbarGroup";
import { ImmersiveToolbarRow, ImmersiveUnsupportedNote } from "./ImmersiveToolbarRow";
import { LayersToolbarGroup } from "./LayersToolbarGroup";
import { PresetsToolbarGroup } from "./PresetsToolbarGroup";
import type { XrBottomToolbarProps } from "./types";
import { ZoomToolbarGroup } from "./ZoomToolbarGroup";

export function XrBottomToolbar({
  onFocusStack,
  onFocusMesh,
  onBalancedView,
  onZoomIn,
  onZoomOut,
  onPresetAll,
  onPresetLesions,
  onPresetShell,
  onEnterImmersiveCentered,
  onToggleFullscreen,
  alternateLabHref,
  alternateLabShortLabel,
  immersiveMode,
  isImmersiveSupported,
  isCheckingSupport = false,
  meshClassVisibility,
  onToggleMeshClass,
  solidBrainEnabled = false,
  onToggleSolidBrain,
}: XrBottomToolbarProps) {
  return (
    <div
      className={cn(
        "safe-bottom pointer-events-auto absolute z-20 flex max-h-[min(45vh,22rem)] flex-col gap-2 overflow-y-auto overscroll-contain px-3 pb-2 sm:bottom-4 sm:gap-2.5 sm:px-4 sm:pb-0",
        "bottom-2 right-3 left-auto w-[min(100%,22rem)] sm:right-4",
      )}
    >
      <CameraToolbarGroup
        onFocusStack={onFocusStack}
        onFocusMesh={onFocusMesh}
        onBalancedView={onBalancedView}
        solidBrainEnabled={solidBrainEnabled}
        onToggleSolidBrain={onToggleSolidBrain}
      />
      <ZoomToolbarGroup onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
      <LayersToolbarGroup meshClassVisibility={meshClassVisibility} onToggleMeshClass={onToggleMeshClass} />
      <PresetsToolbarGroup onPresetAll={onPresetAll} onPresetLesions={onPresetLesions} onPresetShell={onPresetShell} />
      <ImmersiveToolbarRow
        immersiveMode={immersiveMode}
        isImmersiveSupported={isImmersiveSupported}
        isCheckingSupport={isCheckingSupport}
        onEnterImmersiveCentered={onEnterImmersiveCentered}
        onToggleFullscreen={onToggleFullscreen}
        alternateLabHref={alternateLabHref}
        alternateLabShortLabel={alternateLabShortLabel}
      />
      <ImmersiveUnsupportedNote
        immersiveMode={immersiveMode}
        isImmersiveSupported={isImmersiveSupported}
        isCheckingSupport={isCheckingSupport}
      />
    </div>
  );
}
