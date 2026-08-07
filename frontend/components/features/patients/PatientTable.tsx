"use client";

import Link from "next/link";
import { Edit2, Eye, Search, Trash2, User } from "lucide-react";

import type { Patient } from "@/api/domain";
import { LoadingState } from "@/components/ui/loading";

type PatientTableProps = {
  patients: Patient[];
  isLoading: boolean;
  error: unknown;
  filter: string;
  onFilterChange: (value: string) => void;
  onRetry: () => void;
  onEdit: (patient: Patient) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
  mutationError: unknown;
};

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const response = (error as Error & {
    response?: { data?: { detail?: unknown } };
  }).response;
  const detail = response?.data?.detail;
  if (typeof detail === "string") return detail;
  return error.message;
}

export function PatientTable({
  patients,
  isLoading,
  error,
  filter,
  onFilterChange,
  onRetry,
  onEdit,
  onDelete,
  isUpdating,
  isDeleting,
  mutationError,
}: PatientTableProps) {
  const query = filter.trim().toLowerCase();
  const filteredPatients = query
    ? patients.filter(
        (patient) =>
          patient.name.toLowerCase().includes(query) ||
          patient.id.toLowerCase().includes(query) ||
          patient.notes?.toLowerCase().includes(query),
      )
    : patients;

  return (
    <section className="overflow-hidden rounded-xl border-[0.5px] border-[var(--border)] bg-[var(--surface-2)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-3 py-3.5">
        <h2 className="text-[15px] font-medium text-[var(--text-primary)]">Database records</h2>
        <div className="relative w-[280px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Quick filter patients"
            placeholder="Quick filter..."
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--registry-primary)] focus:ring-2 focus:ring-[var(--registry-primary-soft)]"
          />
        </div>
      </div>

      {error ? (
        <div className="m-3 rounded-lg border border-[var(--text-warning)]/30 bg-[var(--registry-warning-soft)] p-3 text-xs text-[var(--text-warning)]">
          <p>Clinical API unavailable. {errorMessage(error)}</p>
          <button type="button" onClick={onRetry} className="mt-1 underline">
            Retry
          </button>
        </div>
      ) : null}

      {mutationError ? (
        <div className="m-3 rounded-lg border border-[var(--text-danger)]/30 bg-[var(--registry-danger-soft)] p-3 text-xs text-[var(--text-danger)]">
          Patient update failed. {errorMessage(mutationError)}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState label="Loading patients..." className="py-16" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <colgroup>
              <col className="w-[45%]" />
              <col />
              <col className="w-[140px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th
                  scope="col"
                  className="px-3 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]"
                >
                  Patient identity
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]"
                >
                  Clinical notes
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => (
                <tr
                  key={patient.id}
                  className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--surface-1)]"
                >
                  <td className="px-3 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {patient.name}
                      </span>
                      <span className="text-[13px] text-[var(--text-secondary)]">
                        DOB: {patient.dateOfBirth || "Not provided"}
                      </span>
                      <Link
                        href={`/patients/${encodeURIComponent(patient.id)}`}
                        className="w-fit text-[13px] text-[var(--registry-primary)] hover:underline"
                      >
                        {patient.id}
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    {patient.notes ? (
                      <p className="max-w-[420px] text-[13px] text-[var(--text-primary)]">
                        {patient.notes}
                      </p>
                    ) : (
                      <span className="text-[13px] italic text-[var(--text-muted)]">
                        No notes provided
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        aria-label="Edit patient"
                        disabled={isUpdating}
                        onClick={() => onEdit(patient)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--registry-primary-soft)] text-[var(--registry-primary-strong)] transition-[filter] hover:brightness-[0.93] disabled:opacity-50"
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <Link
                        href={`/patients/${encodeURIComponent(patient.id)}`}
                        aria-label="View patient record"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--registry-teal-soft)] text-[var(--registry-teal)] transition-[filter] hover:brightness-[0.93]"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        aria-label="Delete patient"
                        disabled={isDeleting}
                        onClick={() => onDelete(patient.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--registry-danger-soft)] text-[var(--text-danger)] transition-[filter] hover:brightness-[0.93] disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-[var(--text-muted)]">
              <User className="h-8 w-8 opacity-40" aria-hidden="true" />
              <p className="text-sm">
                {filter ? "No patients match your filter." : "No patient records found."}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
