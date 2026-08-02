"use client";

import { useState } from "react";

import type { Patient } from "@/api/domain";
import { usePatientMutations, usePatients } from "@/hooks/patients";

const EMPTY_FORM: Partial<Patient> = {
  id: "",
  name: "",
  dateOfBirth: undefined,
  notes: "",
};

export function usePatientsPage() {
  const [addCaseOpen, setAddCaseOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Patient>>(EMPTY_FORM);
  const [filter, setFilter] = useState("");

  const { data: patients = [], isLoading, error, refetch } = usePatients();
  const {
    createPatient,
    updatePatient,
    deletePatient,
    isCreating,
    isUpdating,
    isDeleting,
    createError,
    updateError,
    deleteError,
  } = usePatientMutations();

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = form.name?.trim();
    if (!trimmedName) return;

    try {
      if (editingId) {
        await updatePatient({
          id: editingId,
          payload: {
            name: trimmedName,
            dateOfBirth: form.dateOfBirth ?? undefined,
            notes: form.notes ?? undefined,
          },
        });
      } else {
        await createPatient({
          name: trimmedName,
          dateOfBirth: form.dateOfBirth ?? undefined,
          notes: form.notes ?? undefined,
        });
      }
      resetForm();
    } catch (err) {
      console.error("Patient save failed:", err);
    }
  }

  function handleEdit(patient: Patient) {
    setEditingId(patient.id);
    setForm({
      id: patient.id,
      name: patient.name ?? "",
      dateOfBirth: patient.dateOfBirth ?? undefined,
      notes: patient.notes ?? undefined,
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this patient record?")) return;
    try {
      await deletePatient(id);
      if (editingId === id) resetForm();
      await refetch();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  async function handleAddCaseSubmit() {
    // Patient and study are persisted by upload-study API; refetch via query invalidation.
  }

  return {
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
  };
}
