/**
 * Notifications API — in-app alerts for practitioners.
 */
import { apiFetch } from "../http/client";
import { joinRoute, ROUTES, withSearchParams } from "../http/paths";
import type {
  Notification,
  NotificationCreate,
  NotificationListResponse,
} from "../domain";

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface ListNotificationsParams {
  limit?: number;
  unread_only?: boolean;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listNotifications(
  params: ListNotificationsParams = {},
): Promise<NotificationListResponse> {
  const path = withSearchParams(ROUTES.notifications, {
    limit: params.limit,
    unread_only: params.unread_only,
  });
  return apiFetch<NotificationListResponse>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Per-item actions
// ---------------------------------------------------------------------------

export async function markNotificationRead(
  notificationId: number,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(
    joinRoute(ROUTES.notifications, notificationId, "read"),
    { method: "PATCH" },
  );
}

export async function createNotification(
  payload: NotificationCreate,
): Promise<Notification> {
  return apiFetch<Notification>(ROUTES.notifications, {
    method: "POST",
    body: payload,
  });
}

export async function deleteNotification(
  notificationId: number,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(
    joinRoute(ROUTES.notifications, notificationId),
    { method: "DELETE" },
  );
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

export async function clearNotifications(): Promise<{
  ok: boolean;
  deleted: number;
}> {
  return apiFetch<{ ok: boolean; deleted: number }>(ROUTES.notifications, {
    method: "DELETE",
  });
}
