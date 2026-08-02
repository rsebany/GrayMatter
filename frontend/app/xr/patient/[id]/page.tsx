/**
 * Legacy redirect — `/xr/patient/:id` → `/webxr?patientId=…`
 */
"use client";

import { redirect } from "next/navigation";

type Params = {
  params: {
    id: string;
  };
};

export default function XRPatientRedirect({ params }: Params) {
  redirect(`/webxr?patientId=${encodeURIComponent(params.id)}`);
}
