"use client";

import { useState } from "react";

import type { Patient } from "@/api/domain";
import {
  useCreatePatient,
  useUpdatePatient,
} from "@/hooks/patients/use-patient-mutations";

const EMPTY_FORM: Partial<Patient> = {
  id: "",
  name: "",
  dateOfBirth: undefined,
  notes: "",
};

export function useQuickRegistry() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Patient>>(EMPTY_FORM);
  const create = useCreatePatient();
  const update = useUpdatePatient();

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function editPatient(patient: Patient) {
    setEditingId(patient.id);
    setForm({
      id: patient.id,
      name: patient.name ?? "",
      dateOfBirth: patient.dateOfBirth ?? undefined,
      notes: patient.notes ?? "",
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name?.trim();
    if (!name) return;

    try {
      if (editingId) {
        await update.mutateAsync({
          id: editingId,
          data: {
            name,
            dateOfBirth: form.dateOfBirth ?? undefined,
            notes: form.notes ?? undefined,
          },
        });
      } else {
        await create.mutateAsync({
          name,
          dateOfBirth: form.dateOfBirth ?? undefined,
          notes: form.notes ?? undefined,
        });
      }
      resetForm();
    } catch (error) {
      console.error("Patient save failed:", error);
    }
  }

  return {
    editingId,
    form,
    setForm,
    resetForm,
    editPatient,
    submit,
    isCreating: create.isPending,
    isUpdating: update.isPending,
    createError: create.error,
    updateError: update.error,
  };
}
