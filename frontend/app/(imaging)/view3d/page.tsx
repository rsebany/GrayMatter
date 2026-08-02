/**
 * View 3D — CT stack and optional AI mesh reconstruction.
 */
"use client";

import { View3DReconstructionPanel } from "@/components/features/viewer/View3DReconstructionPanel";
import { ImagingWorkspacePage } from "@/components/features/viewer";

export default function View3DPage() {
  return (
    <ImagingWorkspacePage title="View 3D" breadcrumb="Imaging / View 3D">
      <View3DReconstructionPanel />
    </ImagingWorkspacePage>
  );
}
