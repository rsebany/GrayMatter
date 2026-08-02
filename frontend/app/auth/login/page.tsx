/**
 * Login — institutional email and password.
 */
"use client";

import { useState } from "react";
import Link from "next/link";

import { AppLogo } from "@/components/layout/app-logo";
import { AuthErrorDialog, AuthPage, LoginForm } from "@/components/features/auth";
import { useAuth } from "@/contexts/auth-context";
import { useAuthErrorDialog, useRedirectWhenAuthenticated } from "@/hooks/auth";
import { notify } from "@/lib/notify";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const authError = useAuthErrorDialog("Sign in failed");
  useRedirectWhenAuthenticated();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      notify.success("Signed in successfully");
    } catch (err: unknown) {
      authError.showError(err, "Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPage leftContent={null}>
      <div className="mb-10 lg:hidden">
        <AppLogo size={48} className="mx-auto h-12 w-12 object-contain" />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Welcome Back</h1>
        <p className="mt-2 text-muted-foreground">
          Enter your institutional credentials to continue. All fields marked{" "}
          <span className="font-semibold text-red-500">*</span> are required.
        </p>
      </div>

      <LoginForm
        email={email}
        password={password}
        remember={remember}
        isSubmitting={isSubmitting}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onRememberChange={setRemember}
        onSubmit={handleSubmit}
      />

      <AuthErrorDialog
        open={authError.open}
        onOpenChange={authError.setOpen}
        title={authError.title}
        message={authError.message}
      />

      <div className="mt-8 border-t border-border pt-8 text-center lg:text-left">
        <p className="text-xs text-muted-foreground">
          New to the platform?
          <Link
            href="/auth/signup"
            className="ml-2 font-bold text-sky-500 transition-colors hover:text-sky-400"
          >
            Request Access Credentials
          </Link>
        </p>
      </div>
    </AuthPage>
  );
}
