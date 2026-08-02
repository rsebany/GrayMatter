"use client";

import Link from "next/link";
import { CheckCircle, Loader2, Lock, ShieldAlert } from "lucide-react";

type ResetPasswordContentProps = {
  token: string;
  password: string;
  confirmPassword: string;
  success: boolean;
  isSubmitting: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
};

export function ResetPasswordContent({
  token,
  password,
  confirmPassword,
  success,
  isSubmitting,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: ResetPasswordContentProps) {
  if (success) {
    return (
      <div className="space-y-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <CheckCircle className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Password Updated</h1>
          <p className="mt-3 leading-relaxed text-slate-500">
            Credentials reset successfully. Use your new password to sign in.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-sky-600 font-bold text-white shadow-[0_4px_15px_rgba(14,165,233,0.3)] transition-all hover:bg-sky-500"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Expired Link</h1>
          <p className="mt-3 leading-relaxed text-slate-500">
            This reset link is no longer valid.
          </p>
        </div>
        <Link
          href="/auth/forgot-password"
          className="flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 font-bold text-white transition-all hover:bg-white/10"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">New Password</h1>
        <p className="mt-2 text-slate-500">Update your account credentials.</p>
      </div>

      <form className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Password <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              required
              aria-required="true"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="h-12 w-full border-b border-white/10 bg-transparent pl-10 pr-4 text-sm text-white placeholder:text-slate-600 transition-all focus:border-sky-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Confirm <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              required
              aria-required="true"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              className="h-12 w-full border-b border-white/10 bg-transparent pl-10 pr-4 text-sm text-white placeholder:text-slate-600 transition-all focus:border-sky-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="group relative mt-4 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-sky-600 font-bold text-white shadow-[0_4px_20px_rgba(14,165,233,0.3)] transition-all hover:bg-sky-500 disabled:opacity-70"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Changes"}
        </button>
      </form>
    </>
  );
}
