"use client";

import { Info, Loader2, User } from "lucide-react";

import type { Patient } from "@/api/domain";
import { Button } from "@/components/ui/button";

type QuickRegistryProps = {
  form: Partial<Patient>;
  editingId: string | null;
  onChange: (form: Partial<Patient>) => void;
  onSubmit: (event: React.FormEvent) => void;
  onReset: () => void;
  isCreating: boolean;
  isUpdating: boolean;
};

export function QuickRegistry({
  form,
  editingId,
  onChange,
  onSubmit,
  onReset,
  isCreating,
  isUpdating,
}: QuickRegistryProps) {
  const isBusy = isCreating || isUpdating;
  const isDisabled = !form.name?.trim() || isBusy;

  return (
    <aside className="rounded-xl border-[0.5px] border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--registry-teal-soft)]">
          <User className="h-5 w-5 text-[var(--registry-teal)]" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            {editingId ? "Modify Patient" : "Quick Registry"}
          </h2>
          <p className="text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Metadata Management
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {editingId ? (
          <div className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
              Medical ID (read-only)
            </span>
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              {form.id}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label
            htmlFor="quick-registry-name"
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]"
          >
            Full Name <span className="text-[var(--text-danger)]">*</span>
          </label>
          <input
            id="quick-registry-name"
            required
            type="text"
            value={form.name ?? ""}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            placeholder="Enter legal name"
            className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--registry-primary)] focus:ring-2 focus:ring-[var(--registry-primary-soft)]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="quick-registry-dob"
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]"
          >
            Date of Birth
          </label>
          <input
            id="quick-registry-dob"
            type="date"
            value={form.dateOfBirth ?? ""}
            onChange={(event) =>
              onChange({
                ...form,
                dateOfBirth: event.target.value || undefined,
              })
            }
            className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--registry-primary)] focus:ring-2 focus:ring-[var(--registry-primary-soft)]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="quick-registry-notes"
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]"
          >
            Clinical Context
          </label>
          <textarea
            id="quick-registry-notes"
            rows={4}
            value={form.notes ?? ""}
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
            placeholder="Observations or relevant history (optional)..."
            className="w-full resize-none rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--registry-primary)] focus:ring-2 focus:ring-[var(--registry-primary-soft)]"
          />
        </div>

        <Button
          type="submit"
          disabled={isDisabled}
          aria-disabled={isDisabled}
          className="h-10 w-full rounded-[var(--radius)] bg-[var(--registry-primary)] text-xs font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[var(--surface-1)] disabled:text-[var(--text-muted)] disabled:opacity-100"
        >
          {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {editingId ? "Save Changes" : "Register Patient"}
        </Button>

        {editingId ? (
          <button
            type="button"
            onClick={onReset}
            className="w-full py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Discard changes
          </button>
        ) : null}
      </form>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--registry-info-soft)] p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
        <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
          Registering a patient here creates a shell record. To upload medical imaging (DICOM),
          use the <strong className="font-medium">Full Medical Intake</strong> workflow.
        </p>
      </div>
    </aside>
  );
}
