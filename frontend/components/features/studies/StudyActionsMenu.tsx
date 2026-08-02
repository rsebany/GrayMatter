/**
 * Study row actions — open 2D/3D viewers or download PDF report.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  ChevronDown,
  FileDown,
  Glasses,
  Layers,
} from "lucide-react";

import { getStudyReportPdf } from "@/api/clients";
import { Button } from "@/components/ui/button";
import { studyViewerHref } from "@/lib/imaging";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type StudyActionsMenuProps = {
  studyId: string;
  patientId: string;
  ready: boolean;
  canOpen3d?: boolean;
  showWebXr?: boolean;
};

export function StudyActionsMenu({
  studyId,
  patientId,
  ready,
  canOpen3d = true,
  showWebXr = true,
}: StudyActionsMenuProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const view2dHref = studyViewerHref("/view2d", { studyId, patientId });
  const view3dHref = studyViewerHref("/view3d", { studyId, patientId });
  const xrHref = studyViewerHref("/xr", { studyId, patientId });

  const handleDownloadReport = async () => {
    try {
      setDownloading(true);
      const blob = await getStudyReportPdf(studyId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `study_${studyId}_report.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to download PDF report.";
      window.alert(message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="h-9 w-full bg-sky-600 text-white shadow-sm hover:bg-sky-500 sm:w-auto"
          disabled={!ready}
        >
          Actions
          <ChevronDown className="ml-1 h-4 w-4 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          disabled={!ready}
          onSelect={() => router.push(view2dHref)}
        >
          <Layers className="h-4 w-4" />
          2D viewer
        </DropdownMenuItem>
        {canOpen3d && (
          <>
            <DropdownMenuItem
              disabled={!ready}
              onSelect={() => router.push(view3dHref)}
            >
              <Box className="h-4 w-4" />
              3D viewer
            </DropdownMenuItem>
            {showWebXr && (
              <DropdownMenuItem
                disabled={!ready}
                onSelect={() => router.push(xrHref)}
              >
                <Glasses className="h-4 w-4" />
                WebXR
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!ready || downloading}
          onSelect={(e) => {
            e.preventDefault();
            void handleDownloadReport();
          }}
        >
          <FileDown className="h-4 w-4" />
          {downloading ? "Downloading…" : "Download PDF"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
