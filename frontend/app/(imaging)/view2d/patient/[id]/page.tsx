/**
 * Legacy redirect — `/view2d/patient/:id` → `/view2d?patientId=…`
 */
"use client";

import { redirect } from "next/navigation";

type Params = {
  params: {
    id: string;
  };
};

export default function View2DPatientRedirect({ params }: Params) {
  redirect(`/view2d?patientId=${encodeURIComponent(params.id)}`);
}
