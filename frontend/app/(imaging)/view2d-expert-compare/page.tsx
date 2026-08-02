/**
 * Expert vs AI (2D) — dual-panel axial compare after expert-mask upload.
 */
"use client";

import { ExpertCompare2DPanel } from "@/components/features/viewer/expert-compare/ExpertCompare2DPanel";
import { ImagingWorkspacePage } from "@/components/features/viewer";

export default function View2dExpertComparePage() {
  return (
    <ImagingWorkspacePage
      title="Expert vs AI (2D)"
      breadcrumb="Imaging / Expert vs AI"
      suspense
    >
      <ExpertCompare2DPanel />
    </ImagingWorkspacePage>
  );
}
