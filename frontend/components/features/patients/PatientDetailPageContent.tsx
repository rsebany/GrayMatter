"use client";

import Link from "next/link";
import { Box } from "lucide-react";

import { MRISeriesViewer } from "@/components/features/patients/MRISeriesViewer";
import { PatientHeader } from "@/components/features/patients/PatientHeader";
import { PatientList } from "@/components/features/patients/PatientList";
import { SegmentationStatistics } from "@/components/features/patients/SegmentationStatistics";
import { LoadingState } from "@/components/ui/loading";
import { usePatientDetail, usePatients } from "@/hooks/patients";
import { studyViewerHref } from "@/lib/imaging/imaging-workflow";

type PatientDetailPageContentProps = {
  patientId: string;
};

export function PatientDetailPageContent({ patientId }: PatientDetailPageContentProps) {
  const { data: patients = [], isLoading: patientsLoading } = usePatients();
  const {
    data: detailedPatient,
    isLoading: detailLoading,
    error,
  } = usePatientDetail(patientId);
  const patient = detailedPatient ?? patients.find((item) => item.id === patientId);
  const study =
    [...(patient?.studies ?? [])].sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )[0] ?? null;

  if ((patientsLoading || detailLoading) && !patient) {
    return <LoadingState label="Loading patient record..." className="min-h-[500px]" />;
  }

  if (!patient) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          {error instanceof Error ? error.message : "Patient record not found."}
        </p>
        <Link
          href="/patients"
          className="text-sm font-medium text-[var(--registry-primary)] hover:underline"
        >
          Return to registry
        </Link>
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100dvh-116px)] min-w-[1180px] grid-cols-[260px_minmax(520px,1fr)_300px] gap-4">
      <PatientList
        key={`${patient.id}-${patients.length}`}
        patients={patients}
        selectedPatientId={patient.id}
      />

      <main className="flex min-h-0 min-w-0 flex-col gap-3">
        <PatientHeader patient={patient} study={study} />
        {study ? (
          <MRISeriesViewer key={study.id} studyId={study.id} modality={study.modality} />
        ) : (
          <section className="flex min-h-[480px] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              This patient has no imaging studies yet.
            </p>
            <Link
              href={`/upload-dicom?patientId=${encodeURIComponent(patient.id)}`}
              className="rounded-full bg-[var(--registry-primary)] px-4 py-2 text-xs font-medium text-white"
            >
              Start medical intake
            </Link>
          </section>
        )}
      </main>

      <div className="flex min-h-0 flex-col gap-3 pt-[90px]">
        {study ? (
          <>
            <SegmentationStatistics studyId={study.id} segmentation={study.segmentation} />
            <Link
              href={studyViewerHref("/view3d", {
                studyId: study.id,
                patientId: patient.id,
              })}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--registry-primary)] text-xs font-medium text-white transition-[filter] hover:brightness-95"
            >
              <Box className="h-4 w-4" aria-hidden="true" />
              View 3D
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
