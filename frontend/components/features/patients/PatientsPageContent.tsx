"use client";

import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PatientQuickEditor } from "@/components/features/patients/PatientQuickEditor";
import { PatientTable } from "@/components/features/patients/PatientTable";
import { AddCaseSheet } from "@/components/features/studies/AddCaseSheet";
import { RegistryOverviewHeading } from "@/components/layout";
import { usePatientsPage } from "@/hooks/patients";

export function PatientsPageContent() {
  const {
    addCaseOpen,
    setAddCaseOpen,
    editingId,
    form,
    setForm,
    filter,
    setFilter,
    patients,
    isLoading,
    error,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleAddCaseSubmit,
    isCreating,
    isUpdating,
    isDeleting,
    createError,
    updateError,
    deleteError,
    refetch,
  } = usePatientsPage();

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <RegistryOverviewHeading
            totalLabel="Registered Patients"
            count={patients.length}
            isLoading={isLoading}
          />
          <Button
            onClick={() => setAddCaseOpen(true)}
            className="w-full rounded-xl bg-sky-600 font-semibold text-white hover:bg-sky-500 sm:w-auto"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Full Medical Intake
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <PatientTable
              patients={patients}
              isLoading={isLoading}
              error={error}
              filter={filter}
              onFilterChange={setFilter}
              onRetry={refetch}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
              createError={createError}
              updateError={updateError}
              deleteError={deleteError}
            />
          </div>

          <PatientQuickEditor
            form={form}
            editingId={editingId}
            onChange={setForm}
            onSubmit={handleSubmit}
            onReset={resetForm}
            isCreating={isCreating}
            isUpdating={isUpdating}
          />
        </div>
      </div>
      <AddCaseSheet
        open={addCaseOpen}
        onOpenChange={setAddCaseOpen}
        onSubmit={handleAddCaseSubmit}
      />
    </>
  );
}
