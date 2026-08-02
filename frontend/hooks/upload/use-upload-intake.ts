"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Patient, SegmentationResultDTO } from "@/api/domain";
import { usePatients, usePatientDetail } from "@/hooks/patients";
import { resolveMeshUrl, resolveStlUrl } from "@/api/clients";
import { uploadStudyService } from "@/services/upload";

export type UploadIntakeStep = 1 | 2 | 3;

export type ViewerChoice = {
  patientId: string;
  studyId: string;
  meshPath: string;
  stlPath?: string;
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

function isDicomZip(name: string): boolean {
  return name.toLowerCase().endsWith(".zip");
}

function describeImagingFiles(files: File[]): string {
  if (files.length === 1) return files[0].name;
  if (files.every((f) => isDicomFile(f.name))) {
    return `${files.length} DICOM slices`;
  }
  return `${files.length} files`;
}

export function useUploadIntake() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPatientId = searchParams.get("patientId") ?? "";
  const { data: patientsData = [] } = usePatients();
  const existingPatients = patientsData;

  const [imagingFiles, setImagingFiles] = useState<File[]>([]);

  const [isNewPatient, setIsNewPatient] = useState(false);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [selectedPatient, setSelectedPatient] = useState<Patient | undefined>();
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientDob, setNewPatientDob] = useState("");
  const [studyDescription, setStudyDescription] = useState("");
  const [activeStudyId, setActiveStudyId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const selectedPatientIdForDetail =
    !isNewPatient && patientId ? patientId : undefined;
  const {
    data: selectedPatientDetail,
    isFetching: isFetchingPatientDetail,
  } = usePatientDetail(selectedPatientIdForDetail);

  useEffect(() => {
    if (initialPatientId && existingPatients.length > 0 && !selectedPatient) {
      const p = existingPatients.find((x) => x.id === initialPatientId);
      if (p) setSelectedPatient(p);
    }
  }, [initialPatientId, existingPatients, selectedPatient]);

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    step: string;
    percentage: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [segmentation, setSegmentation] =
    useState<SegmentationResultDTO | null>(null);
  const [noSegmentationMessage, setNoSegmentationMessage] = useState<string | null>(
    null,
  );
  const [viewerChoice, setViewerChoice] = useState<ViewerChoice | null>(null);
  const [intakeStep, setIntakeStep] = useState<UploadIntakeStep>(1);
  const progressTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopProgressTicker = useCallback(() => {
    if (progressTickerRef.current) {
      clearInterval(progressTickerRef.current);
      progressTickerRef.current = null;
    }
  }, []);

  const startProgressTicker = useCallback(
    (from: number, to: number, stepLabel: string, intervalMs = 550) => {
      stopProgressTicker();
      let current = from;
      setUploadProgress({ step: stepLabel, percentage: current });
      progressTickerRef.current = setInterval(() => {
        if (current >= to) {
          stopProgressTicker();
          return;
        }
        current += 1;
        setUploadProgress({ step: stepLabel, percentage: current });
      }, intervalMs);
    },
    [stopProgressTicker],
  );

  useEffect(() => () => stopProgressTicker(), [stopProgressTicker]);

  const selectedPatientDetailForId =
    selectedPatientDetail?.id === patientId ? selectedPatientDetail : undefined;

  useEffect(() => {
    setViewerChoice(null);
  }, [patientId, isNewPatient]);

  useEffect(() => {
    if (isNewPatient || !patientId) {
      setSelectedPatient(undefined);
      return;
    }
    if (selectedPatient?.id === patientId) return;
    const fromList = existingPatients.find((p) => p.id === patientId);
    setSelectedPatient(fromList);
  }, [patientId, isNewPatient, existingPatients, selectedPatient?.id]);

  useEffect(() => {
    if (isNewPatient || !patientId || !selectedPatientDetailForId) {
      setSegmentation(null);
      setActiveStudyId(null);
      return;
    }
    const studiesWithSeg = (selectedPatientDetailForId.studies ?? [])
      .filter((s) => !!s.segmentation)
      .sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime(),
      );
    const study = studiesWithSeg[0];
    if (!study?.segmentation) {
      setSegmentation(null);
      setActiveStudyId(null);
      return;
    }
    const seg = study.segmentation;
    const rawMeshUrl = seg.xr_view?.mesh_url || seg.mesh_url;
    const rawStlUrl = seg.xr_view?.stl_url || seg.stl_url || "";
    const resolvedUrl = resolveMeshUrl(rawMeshUrl);
    const resolvedStl = rawStlUrl ? resolveStlUrl(rawStlUrl) : "";
    const withXrView: SegmentationResultDTO = {
      ...seg,
      mesh_url: resolvedUrl,
      stl_url: resolvedStl,
      xr_view: {
        id: seg.xr_view?.id ?? seg.id,
        mesh_url: resolvedUrl,
        stl_url: resolvedStl,
        clipping_enabled: seg.xr_view?.clipping_enabled ?? true,
      },
    };
    setSegmentation(withXrView);
    setActiveStudyId(study.id);
  }, [selectedPatientDetailForId, isNewPatient, patientId]);

  const hasVolume = imagingFiles.length > 0;
  const imagingLabel = imagingFiles.length ? describeImagingFiles(imagingFiles) : "";

  const patientForBreakdown =
    selectedPatientDetailForId ??
    (selectedPatient?.id === patientId ? selectedPatient : undefined);

  const studiesForSelectedPatient = useMemo(() => {
    if (isNewPatient) return [];
    if (!patientId) return [];
    if (!patientForBreakdown) return [];
    return (patientForBreakdown.studies ?? [])
      .map(
        (s: {
          id: string;
          description?: string | null;
          created_at?: string | null;
          modality?: string;
        }) => ({
          id: s.id,
          description: s.description ?? "Study",
          created_at: s.created_at ?? new Date().toISOString(),
          modality: s.modality,
        }),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [patientForBreakdown, isNewPatient, patientId]);

  const priorStudiesLoading = Boolean(
    !isNewPatient &&
      patientId &&
      isFetchingPatientDetail &&
      !selectedPatientDetailForId,
  );

  const hasCompletedStudyForPatient =
    (!isNewPatient &&
      (patientForBreakdown?.studies?.some((s) => !!s.segmentation) ?? false)) ||
    !!segmentation;

  useEffect(() => {
    if (
      !isNewPatient &&
      patientId &&
      selectedPatientDetailForId
    ) {
      setSelectedPatient(selectedPatientDetailForId);
    }
  }, [selectedPatientDetailForId, isNewPatient, patientId]);

  const canAdvanceToImagingStep = useMemo(() => {
    if (isNewPatient) return newPatientName.trim().length > 0;
    return Boolean(patientId && selectedPatient);
  }, [isNewPatient, newPatientName, patientId, selectedPatient]);

  const canOpenViewerStep = useMemo(
    () => Boolean(segmentation && activeStudyId && patientId),
    [segmentation, activeStudyId, patientId],
  );

  const goToViewerChoiceStep = useCallback(() => {
    if (!segmentation || !activeStudyId || !patientId) return;
    setViewerChoice({
      patientId,
      studyId: activeStudyId,
      meshPath: segmentation.xr_view.mesh_url,
      stlPath: segmentation.xr_view.stl_url || segmentation.stl_url,
    });
    setIntakeStep(3);
  }, [segmentation, activeStudyId, patientId]);

  const runSegmentation = useCallback(async () => {
    const hasPatient = isNewPatient
      ? newPatientName.trim().length > 0
      : patientId && selectedPatient;
    if (!hasPatient) {
      setError(
        isNewPatient
          ? "Enter the patient's name."
          : "Select a patient.",
      );
      return;
    }

    if (!imagingFiles.length) {
      setError("Add a DICOM series (ZIP or folder) or NIfTI (.nii / .nii.gz).");
      return;
    }

    const first = imagingFiles[0];
    const validNifti = imagingFiles.length === 1 && isNiftiFile(first.name);
    const validZip = imagingFiles.length === 1 && isDicomZip(first.name);
    const validDicomFolder = imagingFiles.length > 0 && imagingFiles.every((f) => isDicomFile(f.name));

    if (!validNifti && !validZip && !validDicomFolder) {
      setError(
        "Use a DICOM ZIP, a folder of .dcm files, or a single NIfTI volume.",
      );
      return;
    }

    if (validNifti && !isNiftiFile(first.name)) {
      setError("Please select a valid NIfTI file (.nii or .nii.gz).");
      return;
    }

    setError(null);
    setNoSegmentationMessage(null);
    setViewerChoice(null);
    setLoading(true);
    stopProgressTicker();
    setUploadProgress({ step: "Preparing…", percentage: 8 });

    try {
      const patientPayload = isNewPatient
        ? { id: "", name: newPatientName.trim(), dob: newPatientDob }
        : {
            id: selectedPatient!.id,
            name: selectedPatient!.name || selectedPatient!.id,
            dob: selectedPatient!.dateOfBirth || "",
          };

      const uploadStepLabel = validNifti ? "Uploading NIfTI…" : "Uploading DICOM…";
      setUploadProgress({ step: uploadStepLabel, percentage: 18 });
      startProgressTicker(18, 32, uploadStepLabel, 400);

      await new Promise((r) => setTimeout(r, 300));
      stopProgressTicker();
      startProgressTicker(32, 88, "Running hippocampus segmentation…", 650);

      const data = await uploadStudyService.uploadStudy({
        patient: patientPayload,
        files: imagingFiles,
        description: studyDescription || "Automated hippocampus analysis",
      });

      stopProgressTicker();
      setUploadProgress({ step: "Segmentation…", percentage: 90 });
      const study = data.patient.studies[0];
      if (!study?.segmentation) throw new Error("No segmentation result returned.");

      const seg = study.segmentation;
      const rawMeshUrl = seg.xr_view?.mesh_url || seg.mesh_url;
      const rawStlUrl = seg.xr_view?.stl_url || seg.stl_url || "";
      const resolvedMeshUrl = resolveMeshUrl(rawMeshUrl);
      const resolvedStlUrl = rawStlUrl ? resolveStlUrl(rawStlUrl) : "";

      setUploadProgress({ step: "Building 3D mesh…", percentage: 95 });
      const withXrView: SegmentationResultDTO = {
        ...seg,
        mesh_url: resolvedMeshUrl,
        stl_url: resolvedStlUrl,
        xr_view: {
          id: seg.xr_view?.id ?? seg.id,
          mesh_url: resolvedMeshUrl,
          stl_url: resolvedStlUrl,
          clipping_enabled: seg.xr_view?.clipping_enabled ?? true,
        },
      };
      setSegmentation(withXrView);
      const totalVol =
        withXrView.hippocampus_volume_ml ?? withXrView.total_ild_volume_ml ?? 0;
      if (totalVol === 0) {
        setNoSegmentationMessage(
          "Analysis complete. No hippocampus regions detected on this scan.",
        );
      }
      setActiveStudyId(study.id);

      const newPid = data.patient?.id ?? patientId;
      if (data.patient) {
        setPatientId(newPid);
        setIsNewPatient(false);
        setSelectedPatient(data.patient as Patient);
        setNewPatientName("");
        setNewPatientDob("");
      } else if (newPid) {
        setPatientId(newPid);
      }

      setUploadProgress({ step: "Done", percentage: 100 });
      toast.success("Study saved. AI analysis finished.");
      queryClient.invalidateQueries({ queryKey: ["studies"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      if (newPid && study.id) {
        setViewerChoice({
          patientId: newPid,
          studyId: study.id,
          meshPath: withXrView.xr_view.mesh_url,
          stlPath: withXrView.xr_view.stl_url || withXrView.stl_url,
        });
        setIntakeStep(3);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      stopProgressTicker();
      setLoading(false);
      setTimeout(() => setUploadProgress(null), 2000);
    }
  }, [
    isNewPatient,
    newPatientName,
    selectedPatient,
    patientId,
    imagingFiles,
    studyDescription,
    newPatientDob,
    queryClient,
    stopProgressTicker,
    startProgressTicker,
  ]);

  const openExisting2DViewer = useCallback(() => {
    const pid = patientId;
    if (!pid) return;
    const studyIdToOpen =
      activeStudyId ??
      selectedPatient?.studies?.find((s) => !!s.segmentation)?.id;
    if (!studyIdToOpen) return;
    const params = new URLSearchParams({
      patientId: pid,
      studyId: studyIdToOpen,
    });
    router.push(`/view2d?${params.toString()}`);
  }, [patientId, activeStudyId, selectedPatient?.studies, router]);

  return {
    router,
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
  };
}
