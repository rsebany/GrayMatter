import { ApiError } from "@/api/http/client";

export const AUTH_CONNECTION_ERROR =
  "Connection failed. Ensure the backend API is running and reachable.";

/** Extract a user-facing message from auth API / network errors. */
export function messageFromAuthError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.message || fallback;
  }

  if (err && typeof err === "object") {
    const axiosLike = err as {
      response?: { data?: { detail?: unknown } };
      message?: string;
    };
    if (axiosLike.response) {
      const detail = axiosLike.response.data?.detail;
      if (typeof detail === "string") {
        return detail;
      }
      if (Array.isArray(detail) && detail.length > 0) {
        return String(detail[0]);
      }
      return fallback;
    }

    if (err instanceof TypeError) {
      return AUTH_CONNECTION_ERROR;
    }
    if (
      typeof axiosLike.message === "string" &&
      /failed to fetch|network|load failed/i.test(axiosLike.message)
    ) {
      return AUTH_CONNECTION_ERROR;
    }
  }

  return AUTH_CONNECTION_ERROR;
}

/** @deprecated Use {@link messageFromAuthError} for auth forms. */
export function messageFromApiError(err: unknown, fallback: string): string {
  return messageFromAuthError(err, fallback);
}

export function authErrorTitle(message: string, fallbackTitle: string): string {
  return message === AUTH_CONNECTION_ERROR ? "Connection failed" : fallbackTitle;
}
