"use client";

import { Info, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Patient } from "@/api/domain";

type Props = {
  form: Partial<Patient>;
  editingId: string | null;
  onChange: (form: Partial<Patient>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  isCreating: boolean;
  isUpdating: boolean;
};

export function PatientQuickEditor({
  form,
  editingId,
  onChange,
  onSubmit,
  onReset,
  isCreating,
  isUpdating,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="sticky top-8 rounded-2xl border border-graymatter-border bg-graymatter-card p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div
            className={`rounded-lg p-2 ${
              editingId ? "bg-blue-500/20" : "bg-emerald-500/20"
            }`}
          >
            <User
              className={`h-5 w-5 ${
                editingId ? "text-blue-500" : "text-emerald-500"
              }`}
            />
          </div>
          <div>
            <h2 className="font-bold text-foreground">
              {editingId ? "Modify Patient" : "Quick Registry"}
            </h2>
            <p className="text-[10px] uppercase tracking-tighter text-muted-foreground">
              Metadata Management
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {editingId && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Medical ID (Read-only)
              </label>
              <div className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-mono text-muted-foreground">
                {form.id}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Full Name{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </label>
            <input
              type="text"
              value={form.name ?? ""}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Enter legal name"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Date of Birth
            </label>
            <input
              type="date"
              value={form.dateOfBirth ?? ""}
              onChange={(e) =>
                onChange({
                  ...form,
                  dateOfBirth: e.target.value || undefined,
                })
              }
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-all focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Clinical Context
            </label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              rows={4}
              placeholder="Observations or relevant history (optional)…"
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              disabled={!form.name?.trim() || isCreating || isUpdating}
              className="h-11 w-full rounded-xl bg-sky-600 font-bold hover:bg-sky-500"
            >
              {isCreating || isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingId ? "Save Changes" : "Register Patient"}
            </Button>
            {editingId && (
              <button
                type="button"
                onClick={onReset}
                className="py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Discard Changes
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-graymatter-border bg-graymatter-card-hover p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Registering a patient here creates a shell record. To upload
            medical imaging (DICOM), use the{" "}
            <strong>New Medical Intake</strong> button.
          </p>
        </div>
      </div>
    </div>
  );
}

