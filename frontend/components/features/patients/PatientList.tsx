"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter, Search, UserRound } from "lucide-react";

import type { Patient } from "@/api/domain";

const PAGE_SIZE = 6;

type PatientListProps = {
  patients: Patient[];
  selectedPatientId: string;
};

export function PatientList({ patients, selectedPatientId }: PatientListProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(() => {
    const selectedIndex = patients.findIndex((patient) => patient.id === selectedPatientId);
    return selectedIndex < 0 ? 1 : Math.floor(selectedIndex / PAGE_SIZE) + 1;
  });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return patients;
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(normalized) ||
        patient.id.toLowerCase().includes(normalized),
    );
  }, [patients, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
      <div className="flex gap-2 border-b border-[var(--border)] p-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search patients"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search patients..."
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] pl-8 pr-2 text-[11px] outline-none focus:border-[var(--registry-primary)]"
          />
        </div>
        <button
          type="button"
          aria-label="Filter patient list"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.map((patient) => {
          const selected = patient.id === selectedPatientId;
          return (
            <Link
              key={patient.id}
              href={`/patients/${encodeURIComponent(patient.id)}`}
              aria-current={selected ? "page" : undefined}
              className={`flex min-h-[86px] items-center gap-3 border-b border-[var(--border)] px-3 py-3.5 transition-colors ${
                selected
                  ? "border-l-[3px] border-l-[var(--registry-primary)] bg-[var(--registry-primary-soft)]"
                  : "border-l-[3px] border-l-transparent hover:bg-[var(--surface-1)]"
              }`}
            >
              <UserRound
                className={`h-4 w-4 shrink-0 ${
                  selected ? "text-[var(--registry-primary)]" : "text-[var(--text-muted)]"
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                  {patient.name}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  DOB: {patient.dateOfBirth || "Not provided"}
                </p>
                <p className="truncate text-[10px] text-[var(--registry-primary)]">
                  {patient.id}
                </p>
                {patient.notes ? (
                  <span className="mt-1 inline-block max-w-full truncate rounded bg-[var(--surface-1)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">
                    {patient.notes}
                  </span>
                ) : null}
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
            </Link>
          );
        })}

        {visible.length === 0 ? (
          <p className="p-5 text-center text-xs text-[var(--text-muted)]">No patients found.</p>
        ) : null}
      </div>

      <div className="flex h-12 items-center justify-center gap-3 border-t border-[var(--border)] text-[11px] text-[var(--text-secondary)]">
        <button
          type="button"
          aria-label="Previous patient page"
          disabled={page === 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          className="rounded p-1 hover:bg-[var(--surface-1)] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span>
          {page} / {pageCount}
        </span>
        <button
          type="button"
          aria-label="Next patient page"
          disabled={page === pageCount}
          onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          className="rounded p-1 hover:bg-[var(--surface-1)] disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
