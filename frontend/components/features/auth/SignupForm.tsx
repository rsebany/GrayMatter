"use client";

import { ChevronDown, Loader2, Lock, Mail, User } from "lucide-react";

import type { UserRole } from "@/api/domain";

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "radiologist", label: "Radiologist / Pulmonologist" },
  { value: "referring_physician", label: "Referring Physician" },
];

type SignupFormProps = {
  fullName: string;
  email: string;
  role: UserRole;
  password: string;
  roleDropdownOpen: boolean;
  isSubmitting: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: UserRole) => void;
  onPasswordChange: (value: string) => void;
  setRoleDropdownOpen: (value: boolean) => void;
};

export function SignupForm({
  fullName,
  email,
  role,
  password,
  roleDropdownOpen,
  isSubmitting,
  onSubmit,
  onFullNameChange,
  onEmailChange,
  onRoleChange,
  onPasswordChange,
  setRoleDropdownOpen,
}: SignupFormProps) {
  const selectedRoleLabel =
    ROLE_OPTIONS.find((candidate) => candidate.value === role)?.label ?? role;

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Full Professional Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            required
            aria-required="true"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            className="h-12 w-full rounded-[10px] border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/60"
            placeholder="Dr. Romualdo SEBANY"
          />
        </div>
      </div>

      <div className="space-y-1.5">
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
            placeholder="romualdo.sebany@clinic.dz"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Clinical Role <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            onBlur={() => setTimeout(() => setRoleDropdownOpen(false), 150)}
            className="flex h-12 w-full items-center justify-between rounded-[10px] border border-border bg-card px-4 text-left text-sm text-foreground transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/60"
          >
            <span>{selectedRoleLabel}</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${roleDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>
          {roleDropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[10px] border border-border bg-card shadow-2xl backdrop-blur-xl">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onRoleChange(option.value);
                    setRoleDropdownOpen(false);
                  }}
                  className={`block w-full px-4 py-3 text-left text-sm transition-colors ${
                    role === option.value
                      ? "bg-muted text-sky-500"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="h-12 w-full rounded-[10px] border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/60"
            placeholder="Min. 8 characters"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="group relative mt-6 flex h-12 w-full items-center justify-center overflow-hidden rounded-[999px] bg-primary font-bold text-white shadow-[0_4px_18px_rgba(2,132,199,0.4)] transition-all hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <span className="relative z-10">Create Medical Account</span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </>
        )}
      </button>
    </form>
  );
}
