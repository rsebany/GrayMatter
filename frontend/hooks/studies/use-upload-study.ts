import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadStudy } from "@/api/clients";
import type {
  UploadStudyPatientPayload,
  UploadStudyResponse,
} from "@/api/domain";

interface UploadArgs {
  patient: UploadStudyPatientPayload;
  files: File[];
  description?: string;
}

export function useUploadStudy(p0: {
  onUploadProgress: (percent: number) => void;
  onSuccess: (studyId: string) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<UploadStudyResponse, Error, UploadArgs>({
    mutationFn: ({ patient, files, description }) =>
      uploadStudy(patient, files, description),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const studyId = data.patient.studies[0]?.id;
      if (studyId) {
        toast.success("Study uploaded. AI analysis finished.");
        p0.onSuccess(studyId);
      }
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Upload or AI analysis failed.",
      );
    },
  });
}
