/**
 * Patient registry — list, quick edit, and full medical intake.
 */
"use client";

import { WorkspaceShell } from "@/components/layout";
import { PatientsPageContent } from "@/components/features/patients";

export default function PatientsPage() {
  return (
    <WorkspaceShell
      activePage="patients"
      title="Patient Registry"
      breadcrumb="Dashboard / Patients"
      mainClassName="flex flex-1 flex-col p-3 sm:p-4 md:p-6"
    >
      <PatientsPageContent />
    </WorkspaceShell>
  );
}
