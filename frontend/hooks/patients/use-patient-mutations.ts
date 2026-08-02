import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPatient, updatePatient, deletePatient } from "@/api/clients";
import type {
  CreatePatientPayload,
  Patient,
  UpdatePatientPayload,
} from "@/api/domain";

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation<Patient, Error, CreatePatientPayload>({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation<
    Patient,
    Error,
    { id: string; data: UpdatePatientPayload }
  >({
    mutationFn: ({ id, data }) => updatePatient(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patients", variables.id] });
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deletePatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

/** Combined surface for pages that need create/update/delete in one object. */
export function usePatientMutations() {
  const create = useCreatePatient();
  const update = useUpdatePatient();
  const del = useDeletePatient();

  return {
    createPatient: create.mutateAsync,
    updatePatient: (args: { id: string; payload: UpdatePatientPayload }) =>
      update.mutateAsync({ id: args.id, data: args.payload }),
    deletePatient: del.mutateAsync,
    isCreating: create.isPending,
    isUpdating: update.isPending,
    isDeleting: del.isPending,
    createError: create.error,
    updateError: update.error,
    deleteError: del.error,
  };
}
