/**
 * API route prefixes and path builders.
 *
 * Prefixes match `backend-api` `include_router` paths.
 * Use {@link joinRoute} for path segments so IDs are encoded consistently.
 */

// ---------------------------------------------------------------------------
// Route prefixes
// ---------------------------------------------------------------------------

export const ROUTES = {
  admin: "/admin",
  analytics: "/analytics",
  auth: "/auth",
  patients: "/patients",
  studies: "/studies",
  notifications: "/notifications",
  settings: "/settings",
} as const;

// ---------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------

/** `/resource/a/b` — each segment URL-encoded. */
export function joinRoute(
  base: string,
  ...segments: (string | number)[]
): string {
  const b = base.replace(/\/+$/, "") || "/";
  if (!segments.length) {
    return b;
  }
  const tail = segments.map((s) => encodeURIComponent(String(s))).join("/");
  return `${b}/${tail}`;
}

/** Append optional query string (omits undefined values). */
export function withSearchParams(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const q = search.toString();
  return q.length > 0 ? `${path}?${q}` : path;
}
