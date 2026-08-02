"use client";

import Link from "next/link";
import { Loader2, Lock, Mail } from "lucide-react";

type LoginFormProps = {
  email: string;
  password: string;
  remember: boolean;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberChange: (value: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
};

export function LoginForm({
  email,
  password,
  remember,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onRememberChange,
  onSubmit,
}: LoginFormProps) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Institutional Email <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            required
            aria-required="true"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="h-12 w-full rounded-[10px] border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/60"
            placeholder="name@hospital.dz"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="ml-1 flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Password <span className="text-red-500">*</span>
          </label>
          <Link
            href="/auth/forgot-password"
            title="Recover your password"
            className="text-xs font-bold uppercase tracking-wider text-sky-500 hover:text-sky-400"
          >
            FORGOT?
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            required
            aria-required="true"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="h-12 w-full rounded-[10px] border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/60"
            placeholder="••••••••"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <input
          type="checkbox"
          id="remember"
          checked={remember}
          onChange={(e) => onRememberChange(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-card text-primary focus:ring-primary"
        />
        <label htmlFor="remember" className="text-xs text-muted-foreground">
          Keep me logged in for the duration of my shift
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="group relative mt-4 flex h-12 w-full items-center justify-center overflow-hidden rounded-[999px] bg-primary font-bold text-white shadow-[0_4px_18px_rgba(2,132,199,0.4)] transition-all hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <span className="relative z-10">Sign in to Dashboard</span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </>
        )}
      </button>
    </form>
  );
}
