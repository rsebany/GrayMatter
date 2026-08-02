/**
 * Shared {@link WorkspaceShell} layout for imaging routes (2D/3D, expert compare).
 */
"use client";

import { Suspense, type ReactNode } from "react";

import { WorkspaceShell } from "@/components/layout";
import { ImagingBackToUploadLink } from "@/components/features/viewer/pipeline/ImagingBackToUploadLink";

export type ImagingWorkspacePageProps = {
  title: string;
  breadcrumb: string;
  children: ReactNode;
  /** Wrap viewer in Suspense (required when children use `useSearchParams`). */
  suspense?: boolean;
  suspenseFallback?: ReactNode;
};

const DEFAULT_SUSPENSE_FALLBACK = (
  <p className="text-sm text-muted-foreground">Loading viewer…</p>
);

export function ImagingWorkspacePage({
  title,
  breadcrumb,
  children,
  suspense = false,
  suspenseFallback = DEFAULT_SUSPENSE_FALLBACK,
}: ImagingWorkspacePageProps) {
  const viewer = suspense ? (
    <Suspense fallback={suspenseFallback}>{children}</Suspense>
  ) : (
    children
  );

  return (
    <WorkspaceShell
      activePage="upload_dicom"
      title={title}
      breadcrumb={breadcrumb}
    >
      <ImagingBackToUploadLink />
      {viewer}
    </WorkspaceShell>
  );
}
