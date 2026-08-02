/**
 * Signup — create practitioner account with role selection.
 */
"use client";

import { useState } from "react";
import Link from "next/link";

import type { UserRole } from "@/api/domain";
import { AuthErrorDialog, AuthPage, SignupForm } from "@/components/features/auth";
import { useAuth } from "@/contexts/auth-context";
import { useAuthErrorDialog, useRedirectWhenAuthenticated } from "@/hooks/auth";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("radiologist");
  const [password, setPassword] = useState("");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signup } = useAuth();
  const authError = useAuthErrorDialog("Registration failed");
  useRedirectWhenAuthenticated();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signup(fullName, email, role, password);
    } catch (err: unknown) {
      authError.showError(err, "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPage leftContent={null}>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Create Account</h1>
          <p className="mt-2 text-muted-foreground">
            Provide your professional details to get started. Fields marked{" "}
            <span className="font-semibold text-red-500">*</span> are required.
          </p>
        </div>

        <SignupForm
          fullName={fullName}
          email={email}
          role={role}
          password={password}
          roleDropdownOpen={roleDropdownOpen}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onFullNameChange={setFullName}
          onEmailChange={setEmail}
          onRoleChange={(value: UserRole) => setRole(value)}
          onPasswordChange={setPassword}
          setRoleDropdownOpen={setRoleDropdownOpen}
        />

        <div className="mt-8 border-t border-border pt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-bold text-sky-500 transition-colors hover:text-sky-400"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>

      <AuthErrorDialog
        open={authError.open}
        onOpenChange={authError.setOpen}
        title={authError.title}
        message={authError.message}
      />
    </AuthPage>
  );
}
