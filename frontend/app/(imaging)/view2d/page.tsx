/**
 * View 2D — axial slice review with AI segmentation overlay.
 */
"use client";

import { View2DPanel } from "@/components/features/viewer/View2DPanel";
import { ImagingWorkspacePage } from "@/components/features/viewer";

export default function View2DPage() {
  return (
    <ImagingWorkspacePage title="View 2D" breadcrumb="Imaging / View 2D">
      <View2DPanel />
    </ImagingWorkspacePage>
  );
}
