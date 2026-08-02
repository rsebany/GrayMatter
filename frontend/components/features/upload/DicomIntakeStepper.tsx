"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type DicomIntakeStepperProps = {
  current: 1 | 2 | 3;
  className?: string;
};

type StepConfig = { n: 1 | 2 | 3; label: string };

const STEPS: StepConfig[] = [
  { n: 1, label: "Patient" },
  { n: 2, label: "Imaging" },
  { n: 3, label: "Viewers" },
];

export function DicomIntakeStepper({ current, className }: DicomIntakeStepperProps) {
  return (
    <nav className={cn("mb-6 w-full", className)} aria-label="DICOM upload steps">
      <ol className="flex flex-wrap items-center justify-center gap-1 sm:gap-0">
        {STEPS.map((step, index) => (
          <li key={step.n} className="flex items-center">
            {index > 0 && (
              <span
                className="mx-1.5 h-0.5 w-4 shrink-0 rounded-full bg-border sm:mx-2 sm:w-8"
                aria-hidden
              />
            )}
            <div
              className={cn(
                "flex min-w-0 max-w-[110px] items-center gap-1.5 sm:max-w-none sm:gap-2",
                current === step.n ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-8 sm:w-8 sm:text-xs",
                  current > step.n
                    ? "bg-emerald-500/20 text-emerald-500"
                    : current === step.n
                      ? "bg-sky-500 text-white shadow-sm"
                      : "bg-muted text-muted-foreground"
                )}
                aria-hidden
              >
                {current > step.n ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : step.n}
              </span>
              <span className="min-w-0 text-left text-xs font-semibold leading-tight sm:text-sm sm:font-semibold">
                {step.label}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {current === 1 && "Who is this study for? Then continue."}
        {current === 2 && "Add DICOM or NIfTI and run AI."}
        {current === 3 && "Open 2D, 3D, or WebXR."}
      </p>
    </nav>
  );
}
