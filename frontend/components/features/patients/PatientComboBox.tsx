"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Patient } from "@/api/domain";

type PatientOption = { id: string; name: string };

export type PatientComboboxProps = {
  patients: Patient[];
  value: string;
  onChange: (patientId: string, patient?: Patient) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function PatientCombobox({
  patients,
  value,
  onChange,
  placeholder = "Search by full name...",
  disabled = false,
  className,
}: PatientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const options: PatientOption[] = useMemo(
    () =>
      patients.map((p) => ({
        id: p.id,
        name: p.name || p.id,
      })),
    [patients]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
    );
  }, [options, query]);

  const selected = useMemo(
    () => options.find((o) => o.id === value),
    [options, value]
  );

  useEffect(() => {
    setQuery("");
    setOpen(false);
  }, [value]);

  const handleSelect = useCallback(
    (opt: PatientOption) => {
      onChange(opt.id, patients.find((p) => p.id === opt.id));
      setQuery("");
      setOpen(false);
    },
    [onChange, patients]
  );

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && containerRef.current?.contains(next)) {
      return;
    }
    // Defer so option `click` / `mousedown` can run first; without this,
    // closing the list on blur can unmount rows before `onClick` fires.
    window.setTimeout(() => {
      if (containerRef.current?.contains(document.activeElement)) return;
      setOpen(false);
    }, 0);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative min-w-0 w-full", className)}
    >
      <div
        className={cn(
          "flex min-w-0 h-10 w-full max-w-full items-center rounded-xl border border-input bg-background pl-10 pr-8 text-sm transition-colors",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:outline-none",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <Search className="absolute left-3 h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selected?.name ?? ""}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
            if (!e.target.value) onChange("", undefined);
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="h-full min-w-0 flex-1 bg-transparent outline-none"
          title={!open && selected ? selected.name : undefined}
        />
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : inputRef.current?.focus())}
          className="absolute right-2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {open && (
        <ul
          className="absolute top-full z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-input bg-popover py-1 shadow-lg"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {options.length === 0
                ? "No patients registered. Add one first."
                : "No matches."}
            </li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.id}
                role="option"
                tabIndex={-1}
                aria-selected={String(opt.id) === String(value ?? "").trim()}
                onMouseDown={(e) => {
                  // Avoid input blur-before-click so the row still receives `click`
                  // and parent state updates (selection “sticks”).
                  e.preventDefault();
                }}
                onClick={() => handleSelect(opt)}
                className={cn(
                  "flex min-w-0 cursor-pointer flex-col gap-0.5 px-3 py-2 text-sm transition-colors hover:bg-accent",
                  opt.id === value && "bg-accent"
                )}
              >
                <span className="min-w-0 break-words font-medium leading-snug text-foreground">
                  {opt.name}
                </span>
                <span className="min-w-0 break-all text-[10px] font-mono text-muted-foreground">
                  {opt.id}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
