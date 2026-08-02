"use client";

import Link from "next/link";

import { AppLogo } from "@/components/layout/app-logo";

export function LandingNav() {
  return (
    <nav className="fixed z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <AppLogo size={32} className="h-9 w-9" priority />
          <h1 className="truncate text-xl font-bold tracking-tighter text-white">
            GrayMatter{" "}
            <span className="ml-2 text-xs uppercase tracking-widest text-sky-500">
              Clinical Research
            </span>
          </h1>
        </div>
        <Link
          href="/auth/signup"
          className="text-sm font-medium text-muted-foreground transition hover:text-sky-400"
        >
          View Technical Portfolio
        </Link>
      </div>
    </nav>
  );
}
