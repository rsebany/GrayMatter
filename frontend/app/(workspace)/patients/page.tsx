/**
 * Patient registry — list, quick edit, and full medical intake.
 */
"use client";

import { Suspense } from "react";

import { WorkspaceShell } from "@/components/layout";
import { PatientsPageContent } from "@/components/features/patients";

export default function PatientsPage() {
  return (
    <WorkspaceShell
      activePage="patients"
      title="Registry overview"
      breadcrumb="Dashboard / Patients"
      mainClassName="flex min-w-0 flex-1 flex-col p-6"
    >
      <Suspense>
        <PatientsPageContent />
      </Suspense>
    </WorkspaceShell>
  );
}
