/**
 * Study browser — all AI-processed studies with metrics and viewer links.
 */
"use client";

import { RegistryOverviewHeading, WorkspaceShell } from "@/components/layout";
import { StudiesTableSection } from "@/components/features/studies/StudiesTableSection";
import { useDeleteStudy, useStudies } from "@/hooks/studies";

export default function StudiesPage() {
  const { data: studies = [], isLoading, isError, error } = useStudies();
  const deleteStudyMutation = useDeleteStudy();

  return (
    <WorkspaceShell
      activePage="studies"
      title="Study Browser"
      breadcrumb="Dashboard / Studies"
      mainClassName="flex flex-1 flex-col p-3 sm:p-4 md:p-6"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
        <RegistryOverviewHeading
          title="Study overview"
          totalLabel="Registered Studies"
          count={studies.length}
          isLoading={isLoading}
        />
        <StudiesTableSection
          studies={studies}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onDeleteStudy={(studyId) => deleteStudyMutation.mutateAsync(studyId)}
          isDeletingStudy={deleteStudyMutation.isPending}
        />
      </div>
    </WorkspaceShell>
  );
}
