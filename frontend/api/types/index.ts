/**
 * API domain types aligned with `backend-api` (FastAPI) schemas.
 *
 * Prefer `@/api/domain` as the single import path; modules below mirror backend routers.
 */
export * from "./auth";
export * from "./patients";
export * from "./studies";
export * from "./analytics";
export * from "./settings";
export * from "./notifications";
export * from "./admin";

// ---------------------------------------------------------------------------
// App-specific (not from backend)
// ---------------------------------------------------------------------------

export type AppSidebarPage =
  | "dashboard"
  | "patients"
  | "studies"
  | "upload_dicom"
  | "settings"
  | "admin_dashboard"
  | "admin_users";
