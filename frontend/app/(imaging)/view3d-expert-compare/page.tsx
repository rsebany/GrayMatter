/**
 * Expert vs AI (3D) — dual lung meshes after expert-mask compare.
 */
"use client";

import { ExpertCompare3DPanel } from "@/components/features/viewer/expert-compare/ExpertCompare3DPanel";
import { ImagingWorkspacePage } from "@/components/features/viewer";

const SUSPENSE_FALLBACK = (
  <p className="text-sm text-muted-foreground">Loading 3D viewer…</p>
);

export default function View3dExpertComparePage() {
  return (
    <ImagingWorkspacePage
      title="Expert vs AI (3D)"
      breadcrumb="Imaging / Expert vs AI (3D)"
      suspense
      suspenseFallback={SUSPENSE_FALLBACK}
    >
      <ExpertCompare3DPanel />
    </ImagingWorkspacePage>
  );
}
