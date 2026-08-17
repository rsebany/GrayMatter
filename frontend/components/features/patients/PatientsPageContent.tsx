"use client";

import Link from "next/link";
import { UserPlus } from "lucide-react";

import { QuickRegistry } from "@/components/features/patients/QuickRegistry";
import { PatientTable } from "@/components/features/patients/PatientTable";
import { RegistryOverviewHeading } from "@/components/layout";
import { usePatientsPage } from "@/hooks/patients";

export function PatientsPageContent() {
  const {
    editingId,
    form,
    setForm,
    filter,
    setFilter,
    patients,
    isLoading,
    error,
    resetForm,
    submit,
    editPatient,
    handleDelete,
    isCreating,
    isUpdating,
    isDeleting,
    createError,
    updateError,
    deleteError,
    refetch,
  } = usePatientsPage();

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <RegistryOverviewHeading
          title="Patients Overview"
          totalLabel="registered patients"
          count={patients.length}
          isLoading={isLoading}
        />
        <Link
          href="/upload-dicom"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--registry-primary)] px-5 text-sm font-medium text-white transition-[filter] hover:brightness-95"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Full medical intake
        </Link>
      </div>

      <div className="grid min-w-[980px] grid-cols-[minmax(0,1fr)_300px] items-start gap-5">
        <PatientTable
          patients={patients}
          isLoading={isLoading}
          error={error}
          filter={filter}
          onFilterChange={setFilter}
          onRetry={refetch}
          onEdit={editPatient}
          onDelete={handleDelete}
          isUpdating={isUpdating}
          isDeleting={isDeleting}
          mutationError={createError || updateError || deleteError}
        />

        <QuickRegistry
          form={form}
          editingId={editingId}
          onChange={setForm}
          onSubmit={submit}
          onReset={resetForm}
          isCreating={isCreating}
          isUpdating={isUpdating}
        />
      </div>
    </div>
  );
}
