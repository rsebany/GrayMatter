/**
 * Reset password — set new credentials from email token.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  AuthErrorDialog,
  AuthPage,
  ResetPasswordContent,
} from "@/components/features/auth";
import { useAuthErrorDialog } from "@/hooks/auth";
import { resetPassword } from "@/lib/auth";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const authError = useAuthErrorDialog("Reset failed");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadToken = useCallback(() => {
    const t = searchParams.get("token");
    if (t) setToken(t);
  }, [searchParams]);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      authError.showMessage("Passwords do not match", "Validation error");
      return;
    }
    if (password.length < 8) {
      authError.showMessage("Password must be at least 8 characters", "Validation error");
      return;
    }
    if (!token) {
      authError.showMessage("Invalid or missing reset link.", "Invalid link");
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      authError.showError(err, "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPage leftContent={null}>
      <div className="w-full max-w-sm">
        <ResetPasswordContent
          token={token}
          password={password}
          confirmPassword={confirmPassword}
          success={success}
          isSubmitting={isSubmitting}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handleSubmit}
        />

        <AuthErrorDialog
          open={authError.open}
          onOpenChange={authError.setOpen}
          title={authError.title}
          message={authError.message}
        />

        {!success && token && (
          <div className="mt-12 text-center lg:text-left">
            <Link
              href="/auth/login"
              className="text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-sky-400"
            >
              Cancel and return
            </Link>
          </div>
        )}
      </div>
    </AuthPage>
  );
}
