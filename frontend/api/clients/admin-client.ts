/**
 * Admin API — user directory and system health.
 */
import { apiFetch } from "../http/client";
import { joinRoute, ROUTES } from "../http/paths";
import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  AdminUserListItem,
  HealthCheckResponse,
} from "../domain";

export async function fetchAdminUsers(): Promise<AdminUserListItem[]> {
  return apiFetch<AdminUserListItem[]>(joinRoute(ROUTES.admin, "users"), {
    method: "GET",
  });
}

export async function createAdminUser(
  body: AdminCreateUserRequest,
): Promise<AdminUserListItem> {
  return apiFetch<AdminUserListItem>(joinRoute(ROUTES.admin, "users"), {
    method: "POST",
    body,
  });
}

export async function updateAdminUser(
  userId: number,
  body: AdminUpdateUserRequest,
): Promise<AdminUserListItem> {
  return apiFetch<AdminUserListItem>(
    joinRoute(ROUTES.admin, "users", userId),
    {
      method: "PATCH",
      body,
    },
  );
}

export async function deleteAdminUser(userId: number): Promise<void> {
  await apiFetch<void>(joinRoute(ROUTES.admin, "users", userId), {
    method: "DELETE",
  });
}

export async function fetchHealth(): Promise<HealthCheckResponse> {
  return apiFetch<HealthCheckResponse>("/health", { method: "GET" });
}
