"use client";

import { Toaster } from "sonner";

import { useTheme } from "@/components/layout/theme-provider";

/**
 * Global toast host — place once under {@link ThemeProvider}.
 */
export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      richColors
      closeButton
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "border border-graymatter-border bg-graymatter-card text-foreground shadow-lg",
        },
      }}
    />
  );
}
