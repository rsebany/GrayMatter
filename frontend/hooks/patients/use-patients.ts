import { useQuery } from "@tanstack/react-query";
import { listPatients, getPatient } from "@/api/clients";
import type { Patient } from "@/api/domain";

function coercePatients(value: unknown): Patient[] {
  if (Array.isArray(value)) return value as Patient[];
  if (value && typeof value === "object") {
    const wrapped = value as { items?: unknown; data?: unknown; results?: unknown };
    if (Array.isArray(wrapped.items)) return wrapped.items as Patient[];
    if (Array.isArray(wrapped.data)) return wrapped.data as Patient[];
    if (Array.isArray(wrapped.results)) return wrapped.results as Patient[];
  }
  return [];
}

export function usePatientsList() {
  return useQuery<unknown, Error, Patient[]>({
    queryKey: ["patients"],
    queryFn: listPatients,
    select: coercePatients,
  });
}

export function usePatientDetail(patientId: string | undefined) {
  return useQuery<Patient>({
    queryKey: ["patients", patientId],
    queryFn: () => getPatient(patientId as string),
    enabled: !!patientId,
  });
}

/** Same behavior as `usePatientsList` (shorter export name). */
export function usePatients() {
  return usePatientsList();
}
