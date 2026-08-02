import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signup } from "@/api/clients";
import type { AuthResponse, SignupRequest } from "@/api/domain";

export function useSignupMutation() {
  const queryClient = useQueryClient();

  return useMutation<AuthResponse, Error, SignupRequest>({
    mutationFn: signup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}
