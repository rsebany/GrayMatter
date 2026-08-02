"use client";

import type React from "react";

type AuthPageProps = {
  children: React.ReactNode;
  leftContent?: React.ReactNode;
};

export function AuthBackdrop() {
  return (
    <>
      <div
        className="fixed inset-0 z-0 bg-[url('/assets/background.png')] bg-cover bg-center bg-no-repeat"
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[1] bg-black/65" aria-hidden="true" />
    </>
  );
}

export function AuthPage({ children, leftContent }: AuthPageProps) {
  if (leftContent) {
    return (
      <div className="dark relative flex min-h-dvh flex-col text-foreground lg:flex-row">
        <AuthBackdrop />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">{leftContent}</div>
        <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-8 sm:px-6 lg:w-1/2 lg:p-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8 text-foreground sm:py-10">
      <AuthBackdrop />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
