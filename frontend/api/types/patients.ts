/**
 * Patient types — records and create/update payloads.
 */
import type { Study } from "./studies";

// ---------------------------------------------------------------------------
// Patient entity
// ---------------------------------------------------------------------------

export interface Patient {
  id: string;
  name: string;
  dateOfBirth?: string; // ISO date string
  notes?: string | null;
  studies: Study[];
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreatePatientPayload {
  name: string;
  dateOfBirth?: string;
  notes?: string;
  sex?: string | null;
}

export interface UpdatePatientPayload {
  name?: string;
  dateOfBirth?: string;
  notes?: string;
}
