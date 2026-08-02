/**
 * Low-level HTTP client — base URL, auth headers, fetch wrappers, and {@link ApiError}.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL)) ||
  "http://localhost:8000";

const AUTH_STORAGE_KEY = "graymatter_auth";
const LEGACY_AUTH_STORAGE_KEY = "ildxr_auth";

function readAuthRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (current) return current;
    const legacy = window.localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (legacy) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** If false, do not JSON-encode the body even if it's an object. */
  jsonBody?: boolean;
  /** Request body; objects are JSON-encoded when jsonBody is true. */
  body?: unknown;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function detailToMessage(detail: unknown): string | null {
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    return trimmed || null;
  }
  if (typeof detail === "number" || typeof detail === "boolean") {
    return String(detail);
  }
  if (Array.isArray(detail)) {
    const items = detail
      .map((item) => detailToMessage(item))
      .filter((item): item is string => Boolean(item));
    return items.length ? items.join("; ") : null;
  }
  if (detail && typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    const primary =
      detailToMessage(record.message) ??
      detailToMessage(record.detail) ??
      detailToMessage(record.msg) ??
      detailToMessage(record.error);
    if (primary) {
      return primary;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return null;
    }
  }
  return null;
}

function parseResponseBody(
  text: string,
  contentType: string | null,
): unknown {
  const isJson = contentType?.includes("application/json");
  return text && isJson ? JSON.parse(text) : text;
}

function errorMessageFromBody(data: unknown, status: number): string {
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown }).detail
      : data;
  return (
    detailToMessage(detail) ??
    detailToMessage(data) ??
    `Request failed with status ${status}`
  );
}

function normalizeHeaders(
  headers: HeadersInit | undefined,
  authHeader: Record<string, string>,
): Record<string, string> {
  let normalizedHeaders: Record<string, string> = { ...authHeader };
  if (headers instanceof Headers) {
    normalizedHeaders = {
      ...normalizedHeaders,
      ...Object.fromEntries(headers.entries()),
    };
  } else if (Array.isArray(headers)) {
    normalizedHeaders = { ...normalizedHeaders, ...Object.fromEntries(headers) };
  } else if (headers && typeof headers === "object") {
    normalizedHeaders = {
      ...normalizedHeaders,
      ...(headers as Record<string, string>),
    };
  }
  return normalizedHeaders;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

// ---------------------------------------------------------------------------
// Base URL & auth
// ---------------------------------------------------------------------------

export function getApiBaseUrl(): string {
  return DEFAULT_BASE_URL.replace(/\/+$/, "");
}

export function buildApiUrl(path: string): string {
  return path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${getApiBaseUrl()}/${path.replace(/^\/+/, "")}`;
}

export function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = readAuthRaw();
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as { access_token?: string };
    if (!parsed.access_token) {
      return {};
    }
    return { Authorization: `Bearer ${parsed.access_token}` };
  } catch {
    return {};
  }
}

/** Append JWT for `<img>` / EventSource requests that cannot send Authorization headers. */
export function appendAccessTokenParam(params: URLSearchParams): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = readAuthRaw();
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as { access_token?: string };
    if (parsed.access_token) {
      params.set("access_token", parsed.access_token);
    }
  } catch {
    // ignore malformed auth storage
  }
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

export async function apiFetchRaw(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const url = buildApiUrl(path);
  const { jsonBody = true, headers, body, ...rest } = options;
  const initHeaders = normalizeHeaders(headers, getAuthHeader());
  const isFormData = body instanceof FormData;
  const shouldSendJsonContentType =
    jsonBody && !isFormData && !("Content-Type" in initHeaders);
  if (shouldSendJsonContentType) {
    initHeaders["Content-Type"] = "application/json";
  }

  const init: RequestInit = {
    ...rest,
    headers: initHeaders,
  };
  if (body !== undefined) {
    init.body =
      jsonBody && typeof body === "object" && !(body instanceof FormData)
        ? JSON.stringify(body)
        : (body as BodyInit);
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    const data = parseResponseBody(text, res.headers.get("content-type"));
    throw new ApiError(
      errorMessageFromBody(data, res.status),
      res.status,
      data,
    );
  }
  return res;
}

export async function apiFetch<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const res = await apiFetchRaw(path, options);
  const text = await res.text();
  return parseResponseBody(text, res.headers.get("content-type")) as TResponse;
}

// ---------------------------------------------------------------------------
// Blob & optional (404) responses
// ---------------------------------------------------------------------------

/** GET (or custom method) and return response body as Blob; auth + base URL like {@link apiFetch}. */
export async function apiFetchBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const res = await apiFetchRaw(path, {
    ...options,
    method: options.method ?? "GET",
    jsonBody: false,
  });
  return res.blob();
}

/** JSON GET/POST; returns `null` on 404, rethrows other errors. */
export async function apiFetchAllow404<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse | null> {
  try {
    return await apiFetch<TResponse>(path, options);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

/** Like {@link apiFetchRaw} but returns `null` on 404 (for binary routes). */
export async function apiFetchRawAllow404(
  path: string,
  options: RequestOptions = {},
): Promise<Response | null> {
  try {
    return await apiFetchRaw(path, options);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}
