/**
 * Shared query string for imaging pipeline routes (patient + study context).
 */
export function imagingContextQuery(params: {
  patientId?: string | null;
  studyId?: string | null;
}): string {
  const sp = new URLSearchParams();
  if (params.patientId) sp.set("patientId", params.patientId);
  if (params.studyId) sp.set("studyId", params.studyId);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function studyViewerQuery(params: {
  studyId: string;
  patientId?: string | null;
}): string {
  const sp = new URLSearchParams();
  sp.set("studyId", params.studyId);
  if (params.patientId) {
    sp.set("patientId", params.patientId);
  }
  return sp.toString();
}

export function studyViewerHref(
  route: "/view2d" | "/view3d" | "/xr" | "/webxr",
  params: { studyId: string; patientId?: string | null },
): string {
  return `${route}?${studyViewerQuery(params)}`;
}

export function imagingContextFromSearchParams(searchParams: URLSearchParams): {
  patientId: string | null;
  studyId: string | null;
} {
  return {
    patientId: searchParams.get("patientId"),
    studyId: searchParams.get("studyId"),
  };
}
