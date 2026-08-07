"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useDeletePatient } from "@/hooks/patients/use-patient-mutations";
import { usePatients } from "@/hooks/patients/use-patients";
import { useQuickRegistry } from "@/hooks/patients/use-quick-registry";

export function usePatientsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get("q") ?? "";

  const { data: patients = [], isLoading, error, refetch } = usePatients();
  const registry = useQuickRegistry();
  const deleteMutation = useDeletePatient();

  const setFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("q", value);
      else params.delete("q");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this patient record?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      if (registry.editingId === id) registry.resetForm();
      await refetch();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  return {
    filter,
    setFilter,
    patients,
    isLoading,
    error,
    handleDelete,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
    refetch,
    ...registry,
  };
}
