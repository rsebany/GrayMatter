import type {
  UploadStudyPatientPayload,
  UploadStudyResponse,
} from "@/api/domain";
import { uploadStudy } from "@/api/clients";

export interface UploadStudyRequest {
  patient: UploadStudyPatientPayload;
  files: File[];
  description?: string;
}

export async function uploadStudyRequest(
  payload: UploadStudyRequest,
): Promise<UploadStudyResponse> {
  const { patient, files, description } = payload;
  return uploadStudy(patient, files, description);
}

export const uploadStudyService = {
  uploadStudy: uploadStudyRequest,
};
