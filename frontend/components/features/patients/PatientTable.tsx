"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, User, Eye, Edit2, Trash2, Plus } from "lucide-react";
import { LoadingState } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import type { Patient } from "@/api/domain";

const INITIAL_VISIBLE_COUNT = 7;

type Props = {
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
  createError: unknown;
  updateError: unknown;
  deleteError: unknown;
};

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
  createError,
  updateError,
  deleteError,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setShowAll(false);
  }, [filter]);

  const filteredPatients = !filter.trim()
    ? patients
    : patients.filter((p) => {
        const q = filter.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
        );
      });

  const visiblePatients = showAll
    ? filteredPatients
    : filteredPatients.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenCount = Math.max(0, filteredPatients.length - INITIAL_VISIBLE_COUNT);

  const mutationError = createError || updateError || deleteError;

  return (
    <>
      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
          <p className="mb-1">
            Clinical API unavailable. Please verify your backend connection.
          </p>
          <p className="mb-2 text-xs text-amber-500/80">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred while loading patients."}
          </p>
          <button
            onClick={onRetry}
            className="underline hover:text-foreground"
          >
            Retry
          </button>
        </div>
      )}

      {mutationError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <p className="mb-1 font-semibold">Patient mutation failed.</p>
          <p className="text-xs text-red-500/80">
            {(() => {
              const err = mutationError;
              if (err instanceof Error) {
                const anyErr = err as {
                  message: string;
                  response?: { data?: { detail?: unknown } };
                };
                const detail = anyErr.response?.data?.detail;
                if (typeof detail === "string") return detail;
                if (Array.isArray(detail)) {
                  return detail
                    .map((e: any) =>
                      e && typeof e === "object"
                        ? e.msg ?? e.message ?? JSON.stringify(e)
                        : String(e)
                    )
                    .join("; ");
                }
                if (detail && typeof detail === "object") {
                  return JSON.stringify(detail);
                }
                return anyErr.message;
              }
              return String(err);
            })()}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-graymatter-border bg-graymatter-card shadow-xl">
        <div className="flex flex-col gap-2 border-b border-graymatter-border bg-graymatter-card-hover px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <span className="text-sm font-medium text-muted-foreground">
            Database Records
          </span>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Quick filter..."
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-sky-500 focus:outline-none sm:w-auto"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState
              label="Loading patients..."
              className="py-16"
              iconClassName="h-8 w-8 text-sky-500"
            />
          ) : (
            <table className="min-w-[680px] w-full border-collapse text-left">
              <thead className="bg-graymatter-card-hover text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-semibold sm:px-6 sm:py-4">
                    Patient Identity
                  </th>
                  <th className="px-3 py-3 font-semibold sm:px-6 sm:py-4">
                    Clinical Notes
                  </th>
                  <th className="px-3 py-3 text-right font-semibold sm:px-6 sm:py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graymatter-border">
                {visiblePatients.map((p) => (
                  <tr
                    key={p.id}
                    className="group transition-colors hover:bg-graymatter-card-hover"
                  >
                    <td className="px-3 py-3 sm:px-6 sm:py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">
                          {p.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.dateOfBirth
                            ? `DOB: ${p.dateOfBirth}`
                            : "DOB: —"}
                        </span>
                        <span className="text-xs font-mono uppercase text-sky-500">
                          {p.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4">
                      <p className="max-w-[260px] break-words text-sm text-muted-foreground">
                        {p.notes || (
                          <span className="italic opacity-30">
                            No notes provided
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right sm:px-6 sm:py-4">
                      <div className="flex flex-wrap justify-end gap-1.5 opacity-90 transition-opacity group-hover:opacity-100 sm:gap-2 sm:opacity-60">
                        <button
                          onClick={() => onEdit(p)}
                          disabled={isUpdating}
                          className="rounded-lg bg-blue-500/10 p-2.5 text-blue-500 hover:bg-blue-500/20"
                          title="Edit Metadata"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`/upload-dicom?patientId=${encodeURIComponent(
                            p.id
                          )}`}
                          className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-500 hover:bg-emerald-500/20"
                          title="View Studies & Analyze"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => onDelete(p.id)}
                          disabled={isDeleting}
                          className="rounded-lg bg-red-500/10 p-2.5 text-red-500 hover:bg-red-500/20"
                          title="Delete Record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && filteredPatients.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
              <User className="h-8 w-8 opacity-20" />
              <p>
                {filter
                  ? "No patients match your filter."
                  : "No medical records found in the current view."}
              </p>
            </div>
          )}
          {!isLoading && hiddenCount > 0 && (
            <div className="border-t border-graymatter-border px-3 py-3 text-center sm:px-6">
              {showAll ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setShowAll(false)}
                >
                  Show fewer patients
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-lg border-sky-500/30 text-xs font-semibold text-sky-600 hover:bg-sky-500/10"
                  onClick={() => setShowAll(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  View +
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

