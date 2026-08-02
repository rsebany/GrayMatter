/**
 * Forgot password — request reset link by institutional email.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";

import { AuthErrorDialog, AuthPage } from "@/components/features/auth";
import { useAuthErrorDialog } from "@/hooks/auth";
import { requestPasswordReset } from "@/lib/auth";

const BACK_LINK_CLASS =
  "mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-sky-500";

const CARD_CLASS =
  "rounded-[2rem] border border-graymatter-border p-6 backdrop-blur-2xl shadow-2xl sm:p-8 md:p-10";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const authError = useAuthErrorDialog("Request failed");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    message: string;
    resetUrl?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const data = await requestPasswordReset(email);
      setSuccess({
        message: data.message,
        resetUrl: data.reset_url,
      });
    } catch (err: unknown) {
      authError.showError(err, "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthPage>
        <Link href="/auth/login" className={BACK_LINK_CLASS}>
          <ArrowLeft className="h-3 w-3" /> Back to Login
        </Link>
        <div className={`${CARD_CLASS} text-center`}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/20 text-emerald-500">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Check Your Inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">{success.message}</p>
          {success.resetUrl && (
            <div className="mt-6 rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Development reset link
              </p>
              <Link
                href={success.resetUrl}
                className="block break-all text-sm font-medium text-sky-500 hover:text-sky-400"
              >
                {typeof window !== "undefined"
                  ? window.location.origin + success.resetUrl
                  : success.resetUrl}
              </Link>
            </div>
          )}
          <Link
            href="/auth/login"
            className="mt-8 inline-block rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-500"
          >
            Return to Login
          </Link>
        </div>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <Link href="/auth/login" className={BACK_LINK_CLASS}>
        <ArrowLeft className="h-3 w-3" /> Back to Login
      </Link>
      <div className={CARD_CLASS}>
        <h1 className="text-2xl font-bold text-foreground">Reset Your Password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your institutional email and we&apos;ll send you reset instructions.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Institutional Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-[10px] border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/60"
                placeholder="name@hospital.dz"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-[999px] bg-primary font-bold text-white shadow-[0_4px_18px_rgba(2,132,199,0.4)] transition-all hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <span className="relative z-10">Send Reset Link</span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              </>
            )}
          </button>
        </form>
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
