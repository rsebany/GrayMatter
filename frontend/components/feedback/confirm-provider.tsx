"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Use destructive styling for the confirm button (delete, irreversible). */
  variant?: "default" | "destructive";
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null);
  const settledRef = React.useRef(false);

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    settledRef.current = false;
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const finish = React.useCallback((result: boolean) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setOpen(false);
    const fn = resolveRef.current;
    resolveRef.current = null;
    fn?.(result);
    queueMicrotask(() => {
      setOptions(null);
      settledRef.current = false;
    });
  }, []);

  React.useEffect(() => {
    return () => {
      resolveRef.current = null;
    };
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !settledRef.current) finish(false);
        }}
      >
        <AlertDialogContent>
          {options && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{options.title}</AlertDialogTitle>
                {options.description ? (
                  <AlertDialogDescription>
                    {options.description}
                  </AlertDialogDescription>
                ) : null}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => finish(false)}
                  >
                    {options.cancelText ?? "Cancel"}
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    type="button"
                    variant={
                      options.variant === "destructive"
                        ? "destructive"
                        : "default"
                    }
                    className={
                      options.variant !== "destructive"
                        ? "bg-sky-600 text-white hover:bg-sky-500"
                        : undefined
                    }
                    onClick={() => finish(true)}
                  >
                    {options.confirmText ?? "Continue"}
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}
