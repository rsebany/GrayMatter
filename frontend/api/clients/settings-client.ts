/**
 * Practitioner settings API — profile and application preferences.
 */
import { apiFetch } from "../http/client";
import { ROUTES } from "../http/paths";
import type {
  PractitionerSettings,
  PractitionerSettingsUpdate,
} from "../domain";

// ---------------------------------------------------------------------------
// Read & write
// ---------------------------------------------------------------------------

export async function fetchSettings(): Promise<PractitionerSettings> {
  return apiFetch<PractitionerSettings>(ROUTES.settings, { method: "GET" });
}

export async function updateSettings(
  payload: PractitionerSettingsUpdate,
): Promise<PractitionerSettings> {
  return apiFetch<PractitionerSettings>(ROUTES.settings, {
    method: "PUT",
    body: payload,
  });
}
