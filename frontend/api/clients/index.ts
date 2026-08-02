/**
 * HTTP clients for the FastAPI backend.
 *
 * Import from `@/api/clients` or a specific module (e.g. `@/api/clients/studies-client`).
 *
 * Modules:
 * - admin-client — user directory, health
 * - analytics-client — dashboard metrics
 * - auth-client — login, session, password recovery
 * - notifications-client — practitioner alerts
 * - patients-client — patient CRUD
 * - settings-client — practitioner preferences
 * - studies-client — studies, upload, DICOM, expert compare
 */
export * from "./admin-client";
export * from "./analytics-client";
export * from "./auth-client";
export * from "./notifications-client";
export * from "./patients-client";
export * from "./settings-client";
export * from "./studies-client";
