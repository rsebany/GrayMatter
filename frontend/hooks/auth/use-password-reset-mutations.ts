import { useMutation } from "@tanstack/react-query";
import { requestPasswordReset, resetPassword } from "@/api/clients";
import type {
  ForgotPasswordResponse,
  ResetPasswordRequest,
} from "@/api/domain";

export function useRequestPasswordReset() {
  return useMutation<ForgotPasswordResponse, Error, { email: string }>({
    mutationFn: ({ email }) => requestPasswordReset(email),
  });
}

export function useResetPassword() {
  return useMutation<{ message: string }, Error, ResetPasswordRequest>({
    mutationFn: resetPassword,
  });
}
