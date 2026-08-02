/**
 * Patients API — CRUD for patient records linked to studies.
 */
import { apiFetch } from "../http/client";
import { joinRoute, ROUTES } from "../http/paths";
import type {
  CreatePatientPayload,
  Patient,
  UpdatePatientPayload,
} from "../domain";

// ---------------------------------------------------------------------------
// List & read
// ---------------------------------------------------------------------------

export async function listPatients(): Promise<Patient[]> {
  return apiFetch<Patient[]>(ROUTES.patients, { method: "GET" });
}

export async function getPatient(patientId: string): Promise<Patient> {
  return apiFetch<Patient>(joinRoute(ROUTES.patients, patientId), {
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// Create & update
// ---------------------------------------------------------------------------

export async function createPatient(
  payload: CreatePatientPayload,
): Promise<Patient> {
  return apiFetch<Patient>(ROUTES.patients, {
    method: "POST",
    body: payload,
  });
}

export async function updatePatient(
  patientId: string,
  payload: UpdatePatientPayload,
): Promise<Patient> {
  return apiFetch<Patient>(joinRoute(ROUTES.patients, patientId), {
    method: "PUT",
    body: payload,
  });
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deletePatient(patientId: string): Promise<void> {
  await apiFetch<void>(joinRoute(ROUTES.patients, patientId), {
    method: "DELETE",
  });
}
