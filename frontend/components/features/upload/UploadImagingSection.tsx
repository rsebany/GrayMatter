import { Activity, Box, UploadCloud, Layers, Scan, Sparkles } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import type { Patient } from "@/api/domain";
import { cn } from "@/lib/utils";

type UploadImagingSectionProps = {
  secondaryButtonLabel?: string;
  imagingFiles: File[];
  imagingLabel: string;
  hasCompletedStudyForPatient: boolean;
  hasVolume: boolean;
  loading: boolean;
  uploadProgress: { step: string; percentage: number } | null;
  isNewPatient: boolean;
  newPatientName: string;
  selectedPatient?: Patient;
  patientId: string;
  segmentationPresent: boolean;
  stlDownloadUrl?: string;
  onImagingFilesChange: (files: File[]) => void;
  onRunSegmentation: () => void;
  onOpen2DViewer: () => void;
  primaryActionLabel?: string;
  error: string | null;
};

function isNiftiFile(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith("._") || lower.includes("/._") || lower.includes("\\._")) {
    return false;
  }
  return lower.endsWith(".nii") || lower.endsWith(".nii.gz");
}

function isDicomFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".dcm") || lower.endsWith(".dicom");
}

export function UploadImagingSection({
  secondaryButtonLabel = "2D Viewer",
  imagingFiles,
  imagingLabel,
  hasCompletedStudyForPatient,
  hasVolume,
  loading,
  uploadProgress,
  isNewPatient,
  newPatientName,
  selectedPatient,
  patientId,
  segmentationPresent,
  stlDownloadUrl,
  onImagingFilesChange,
  onRunSegmentation,
  onOpen2DViewer,
  primaryActionLabel = "RUN AI ANALYSIS",
  error,
}: UploadImagingSectionProps) {
  const canRunSegmentation =
    !loading &&
    hasVolume &&
    (isNewPatient ? newPatientName.trim().length > 0 : !!selectedPatient) &&
    !hasCompletedStudyForPatient;

  const canOpen2DViewer =
    !!patientId && (segmentationPresent || !!selectedPatient);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Enter" && canRunSegmentation) {
        e.preventDefault();
        onRunSegmentation();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canRunSegmentation, onRunSegmentation]);

  const handleFileList = (list: FileList | null) => {
    if (!list?.length) {
      onImagingFilesChange([]);
      return;
    }
    const picked = Array.from(list);
    if (picked.length === 1 && isNiftiFile(picked[0].name)) {
      onImagingFilesChange(picked);
      return;
    }
    if (picked.length === 1 && picked[0].name.toLowerCase().endsWith(".zip")) {
      onImagingFilesChange(picked);
      return;
    }
    const dicomOnly = picked.filter((f) => isDicomFile(f.name));
    if (dicomOnly.length > 0) {
      onImagingFilesChange(dicomOnly);
      return;
    }
    alert("Use a DICOM ZIP, a folder of .dcm files, or a single NIfTI volume.");
    onImagingFilesChange([]);
  };

  return (
    <div className="group relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-graymatter-border bg-graymatter-card shadow-sm">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(6,182,212,0.08),transparent_50%)]"
        aria-hidden
      />

      <div className="relative border-b border-border/50 px-5 py-4 sm:px-6">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/15 text-[10px] font-bold text-cyan-400"
              aria-hidden
            >
              2
            </span>
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-500">
              <Scan className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                MRI imaging
                <span className="ml-1.5 text-destructive" aria-label="required">
                  *
                </span>
              </h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Full-brain DICOM (ZIP / folder) or hippocampus NIfTI (.nii / .nii.gz).
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200">
            <UploadCloud className="h-3.5 w-3.5" />
            DICOM / NIfTI
          </div>
        </div>
      </div>

      <div className="relative space-y-5 p-5 sm:px-6 sm:py-6">
        <div
          className={cn(
            "relative flex min-h-[220px] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed px-4 py-10 transition-[border-color,background,opacity]",
            "bg-[length:20px_20px] [background-image:radial-gradient(circle_at_center,rgba(100,116,139,0.12)_0.5px,transparent_0.5px)]",
            hasCompletedStudyForPatient
              ? "pointer-events-none cursor-not-allowed border-border/30 opacity-50"
              : "border-cyan-500/25 bg-gradient-to-b from-cyan-500/[0.04] to-background/40 hover:border-cyan-500/40 hover:bg-cyan-500/[0.06]"
          )}
        >
          <div className="relative flex flex-col items-center text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-500 shadow-inner">
              <UploadCloud className="h-8 w-8" strokeWidth={1.25} />
            </div>
            <p className="text-sm font-semibold text-foreground">Drop or browse</p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              DICOM ZIP, DICOM folder (.dcm), or single NIfTI volume at native resolution.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <label
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/15 transition-transform",
                  hasCompletedStudyForPatient
                    ? "cursor-not-allowed opacity-50"
                    : "hover:from-cyan-500 hover:to-sky-500 active:scale-[0.98]"
                )}
              >
                <UploadCloud className="h-4 w-4 opacity-90" />
                DICOM ZIP / NIfTI
                <input
                  type="file"
                  className="hidden"
                  accept=".zip,.nii,.gz,application/gzip,application/dicom,.dcm"
                  disabled={hasCompletedStudyForPatient}
                  onChange={(e) => handleFileList(e.target.files)}
                />
              </label>
              <label
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border border-cyan-500/30 bg-background/60 px-5 py-2.5 text-xs font-bold text-cyan-200 transition-transform",
                  hasCompletedStudyForPatient
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-cyan-500/10 active:scale-[0.98]"
                )}
              >
                DICOM folder
                <input
                  type="file"
                  className="hidden"
                  multiple
                  // @ts-expect-error webkitdirectory is supported in Chromium
                  webkitdirectory=""
                  disabled={hasCompletedStudyForPatient}
                  onChange={(e) => handleFileList(e.target.files)}
                />
              </label>
            </div>

            {hasVolume && !hasCompletedStudyForPatient && (
              <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-cyan-600/90 dark:text-cyan-300/80">
                <Sparkles className="h-3.5 w-3.5" />
                Ready to run hippocampus segmentation.
              </p>
            )}
          </div>

          {hasVolume && (
            <div className="mt-2 flex w-full max-w-md items-center justify-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.1] py-1.5 text-[11px] font-semibold text-emerald-200">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                <Box className="h-3 w-3" />
              </span>
              <span className="truncate px-1">{imagingLabel}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
          <Button
            onClick={onRunSegmentation}
            disabled={!canRunSegmentation}
            className={cn(
              "h-12 flex-1 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 font-bold text-white shadow-md shadow-cyan-500/10 hover:from-cyan-500 hover:to-sky-500",
              hasCompletedStudyForPatient && "pointer-events-none opacity-50"
            )}
          >
            {loading && uploadProgress ? (
              <span className="flex items-center justify-center gap-2">
                <Activity className="h-4 w-4 animate-spin" />
                <span className="tabular-nums">{uploadProgress.percentage}%</span>
                <span className="hidden sm:inline">— {uploadProgress.step}</span>
              </span>
            ) : loading ? (
              <Activity className="h-4 w-4 animate-spin" />
            ) : (
              primaryActionLabel
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl border-border/80 bg-background/40 px-6"
            disabled={!canOpen2DViewer}
            onClick={onOpen2DViewer}
          >
            <Layers className="mr-2 h-4 w-4" /> {secondaryButtonLabel}
          </Button>
        </div>

        {stlDownloadUrl && (
          <div className="flex justify-center">
            <a
              href={stlDownloadUrl}
              download
              className="text-xs font-semibold text-cyan-400 underline-offset-4 hover:underline"
            >
              Download STL mesh
            </a>
          </div>
        )}

        {hasCompletedStudyForPatient && (
          <p className="text-center text-[11px] font-medium leading-relaxed text-amber-500">
            This patient already has a study here. Use 2D/3D viewers, or you may create a duplicate.
          </p>
        )}

        {!loading && !hasCompletedStudyForPatient && hasVolume && (
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono">Ctrl</span>
            <span>+</span>
            <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono">Enter</span>
            <span>Run AI</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">
            <span
              className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
              aria-hidden
            />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
