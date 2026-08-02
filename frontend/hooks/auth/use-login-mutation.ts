import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "@/api/clients";
import type { AuthResponse, LoginRequest } from "@/api/domain";

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation<AuthResponse, Error, LoginRequest>({
    mutationFn: login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}
