/**
 * MRI upload — patient intake, NIfTI upload, and AI analysis trigger.
 */
"use client";

import { WorkspaceShell } from "@/components/layout";
import { UploadPanel } from "@/components/features/upload/UploadPanel";

export default function UploadDicomPage() {
  return (
    <WorkspaceShell
      activePage="upload_dicom"
      title="Upload MRI"
      mainClassName="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-1 p-4 sm:p-6"
    >
      <UploadPanel />
    </WorkspaceShell>
  );
}
