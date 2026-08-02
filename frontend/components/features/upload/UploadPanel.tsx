"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUploadIntake } from "@/hooks/upload";
import { UploadPatientSection } from "@/components/features/upload/UploadPatientSection";
import { UploadImagingSection } from "@/components/features/upload/UploadImagingSection";
import { PostAnalysisViewChoice } from "@/components/features/viewer/pipeline/PostAnalysisViewChoice";
import { DicomIntakeStepper } from "@/components/features/upload/DicomIntakeStepper";
import { UploadPatientSummaryCard } from "@/components/features/upload/upload-patient-summary-card";
import { UploadIntakeNotifications } from "@/components/features/upload/upload-intake-notifications";
// import { ExpertMaskCompareSection } from "@/components/features/upload/ExpertMaskCompareSection";
import { UploadAiProgressFooter } from "@/components/features/upload/upload-ai-progress-footer";
import { cn } from "@/lib/utils";

export function UploadPanel() {
  const {
    existingPatients,
    imagingFiles,
    setImagingFiles,
    imagingLabel,
    isNewPatient,
    setIsNewPatient,
    patientId,
    setPatientId,
    selectedPatient,
    setSelectedPatient,
    newPatientName,
    setNewPatientName,
    newPatientDob,
    setNewPatientDob,
    studyDescription,
    setStudyDescription,
    loading,
    uploadProgress,
    error,
    setError,
    segmentation,
    noSegmentationMessage,
    viewerChoice,
    setViewerChoice,
    intakeStep,
    setIntakeStep,
    studiesForSelectedPatient,
    priorStudiesLoading,
    hasVolume,
    hasCompletedStudyForPatient,
    activeStudyId,
    canAdvanceToImagingStep,
    canOpenViewerStep,
    goToViewerChoiceStep,
    runSegmentation,
    openExisting2DViewer,
  } = useUploadIntake();

  const showAiProgress = loading && uploadProgress;

  return (
    <>
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-1 gap-6",
          showAiProgress && "pb-24",
        )}
      >
      <section className="flex flex-[1.4] flex-col gap-7">
        <DicomIntakeStepper current={intakeStep} />

        {intakeStep === 1 && (
          <>
            <UploadPatientSection
              isNewPatient={isNewPatient}
              existingPatients={existingPatients}
              patientId={patientId}
              selectedPatient={selectedPatient}
              newPatientName={newPatientName}
              newPatientDob={newPatientDob}
              studyDescription={studyDescription}
              studiesForSelectedPatient={studiesForSelectedPatient}
              priorStudiesLoading={priorStudiesLoading}
              setIsNewPatient={(v) => {
                setIsNewPatient(v);
                if (v) {
                  setPatientId("");
                  setSelectedPatient(undefined);
                  setStudyDescription("");
                } else {
                  setNewPatientName("");
                  setNewPatientDob("");
                }
              }}
              setPatientId={setPatientId}
              setSelectedPatient={setSelectedPatient}
              setNewPatientName={setNewPatientName}
              setNewPatientDob={setNewPatientDob}
              setStudyDescription={setStudyDescription}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                size="lg"
                className="gap-2 font-semibold"
                disabled={!canAdvanceToImagingStep}
                onClick={() => {
                  if (!canAdvanceToImagingStep) return;
                  setError(null);
                  setIntakeStep(2);
                }}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {intakeStep === 2 && (
          <>
            <UploadPatientSummaryCard
              isNewPatient={isNewPatient}
              newPatientName={newPatientName}
              selectedPatient={selectedPatient}
              studyDescription={studyDescription}
              actions={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setIntakeStep(1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              }
            />

            {(canOpenViewerStep || viewerChoice) && (
              <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-foreground">
                  {viewerChoice
                    ? "AI done — pick 2D, 3D, WebXR, or download the PDF report."
                    : "AI ready — continue to pick a viewer."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                  onClick={() => {
                    if (viewerChoice) setIntakeStep(3);
                    else goToViewerChoiceStep();
                  }}
                >
                  {viewerChoice ? "Viewers" : "Next: viewers →"}
                </Button>
              </div>
            )}

            <UploadImagingSection
              secondaryButtonLabel="2D"
              primaryActionLabel="Run AI"
              hasCompletedStudyForPatient={hasCompletedStudyForPatient}
              hasVolume={hasVolume}
              imagingFiles={imagingFiles}
              imagingLabel={imagingLabel}
              loading={loading}
              uploadProgress={uploadProgress}
              isNewPatient={isNewPatient}
              newPatientName={newPatientName}
              selectedPatient={selectedPatient}
              patientId={patientId}
              segmentationPresent={!!segmentation}
              stlDownloadUrl={segmentation?.stl_url || segmentation?.xr_view?.stl_url}
              onImagingFilesChange={setImagingFiles}
              onRunSegmentation={runSegmentation}
              onOpen2DViewer={openExisting2DViewer}
              error={error}
            />

            {/* Expert mask compare — hidden until needed
            <ExpertMaskCompareSection
              defaultStudyId={viewerChoice?.studyId ?? activeStudyId ?? null}
            />
            */}
          </>
        )}

        {intakeStep === 3 && viewerChoice && (
          <>
            <UploadPatientSummaryCard
              isNewPatient={isNewPatient}
              newPatientName={newPatientName}
              selectedPatient={selectedPatient}
              actions={
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIntakeStep(2)}
                  >
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                    Imaging
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setViewerChoice(null);
                      setIntakeStep(1);
                    }}
                  >
                    Edit
                  </Button>
                </>
              }
            />

            <PostAnalysisViewChoice
              patientId={viewerChoice.patientId}
              studyId={viewerChoice.studyId}
              meshPath={viewerChoice.meshPath}
              title="Pick a viewer"
            />
          </>
        )}
      </section>

      <UploadIntakeNotifications
        noSegmentationMessage={noSegmentationMessage}
        showAnalysisComplete={Boolean(
          segmentation && uploadProgress?.percentage === 100,
        )}
      />
      </div>

      
    </>
  );
}
