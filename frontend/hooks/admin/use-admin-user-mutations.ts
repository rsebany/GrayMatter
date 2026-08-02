import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createAdminUser,
  deleteAdminUser,
  updateAdminUser,
} from "@/api/clients/admin-client";
import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  AdminUserListItem,
} from "@/api/domain";
import { notify } from "@/lib/notify";

const USERS_QUERY_KEY = ["admin", "users"] as const;

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminCreateUserRequest) => createAdminUser(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      notify.success("User created");
    },
    onError: (err: Error) => {
      notify.error(err.message || "Could not create user");
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: number;
      body: AdminUpdateUserRequest;
    }) => updateAdminUser(userId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      notify.success("User updated");
    },
    onError: (err: Error) => {
      notify.error(err.message || "Could not update user");
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => deleteAdminUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      notify.success("User deleted");
    },
    onError: (err: Error) => {
      notify.error(err.message || "Could not delete user");
    },
  });
}

export type { AdminUserListItem };
