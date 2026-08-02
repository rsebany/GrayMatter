"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STUDY_LABEL_PRESETS } from "@/lib/imaging/study-label-presets";

const uploadFieldClass =
  "h-11 w-full rounded-lg border border-border/80 bg-background/60 px-3.5 text-sm text-foreground shadow-sm outline-none transition-[border,box-shadow] focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20";

type StudyLabelFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Upload flow uses compact field; case sheet uses taller shadcn `Input`. */
  variant?: "upload" | "sheet";
};

export function StudyLabelField({
  id,
  value,
  onChange,
  placeholder = "Type a label or pick a common case below",
  className,
  variant = "upload",
}: StudyLabelFieldProps) {
  const listId = useId();
  const labelClass =
    variant === "sheet"
      ? "text-[11px] font-bold uppercase text-muted-foreground tracking-wider"
      : "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <label className={labelClass} htmlFor={id}>
        Study label{" "}
        <span className="font-normal normal-case tracking-normal">(optional)</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {STUDY_LABEL_PRESETS.map((preset) => {
          const active =
            value.trim().length > 0 && value.trim() === preset.trim();
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "border-sky-500/60 bg-sky-500/15 text-sky-200"
                  : "border-border/70 bg-muted/25 text-muted-foreground hover:border-sky-500/35 hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {preset}
            </button>
          );
        })}
      </div>
      {variant === "sheet" ? (
        <Input
          id={id}
          type="text"
          list={listId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className="h-12 rounded-xl border-border bg-background text-foreground"
        />
      ) : (
        <input
          id={id}
          type="text"
          list={listId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={uploadFieldClass}
          autoComplete="off"
        />
      )}
      <datalist id={listId}>
        {STUDY_LABEL_PRESETS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <p className="text-[11px] text-muted-foreground/90">
        Leave blank to use the default name in lists, or choose a common case / type your own.
      </p>
    </div>
  );
}
