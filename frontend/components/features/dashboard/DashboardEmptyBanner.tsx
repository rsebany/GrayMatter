/**
 * Welcome banner when the workspace has no patients or studies yet.
 */
"use client";

import Link from "next/link";
import { Upload, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export type DashboardEmptyBannerProps = {
  canUpload: boolean;
  canManagePatients: boolean;
};

export function DashboardEmptyBanner({
  canUpload,
  canManagePatients,
}: DashboardEmptyBannerProps) {
  if (!canUpload && !canManagePatients) {
    return null;
  }

  return (
    <div className="rounded-xl border border-sky-500/25 bg-gradient-to-r from-sky-500/10 via-transparent to-violet-500/5 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Get started — </span>
          upload HRCT or add a patient.
        </p>
        <div className="flex flex-wrap gap-2">
          {canManagePatients && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/patients">
                <Users className="h-4 w-4" />
                Patients
              </Link>
            </Button>
          )}
          {canUpload && (
            <Button
              asChild
              size="sm"
              className="gap-2 bg-sky-600 hover:bg-sky-500"
            >
              <Link href="/upload-dicom">
                <Upload className="h-4 w-4" />
                Upload
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
