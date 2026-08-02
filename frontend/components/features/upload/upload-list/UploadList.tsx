"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Eye,
  Edit2,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadListPagination } from "./UploadListPagination";
import { UploadListToolbar } from "./UploadListToolbar";
import { getInitials, statusColor } from "./upload-list-utils";

export type UploadListPatient = {
  id: string;
  name: string;
  notes?: string;
};

export type UploadListStudy = {
  id: string;
  patientId: string;
  description: string;
  status?: string;
};

type ListTab = "all" | "patients" | "studies";

type UnifiedRow =
  | {
      type: "patient";
      id: string;
      name: string;
      subId: string;
      typeLabel: string;
      modality: string;
      status: string;
    }
  | {
      type: "study";
      id: string;
      name: string;
      subId: string;
      typeLabel: string;
      modality: string;
      status: string;
    };

const PAGE_SIZE = 10;

export type UploadListProps = {
  patients?: UploadListPatient[];
  studies?: UploadListStudy[];
  pageSize?: number;
};

export function UploadList({
  patients = [],
  studies = [],
  pageSize = PAGE_SIZE,
}: UploadListProps) {
  const [activeTab, setActiveTab] = useState<ListTab>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const unifiedRows = useMemo((): UnifiedRow[] => {
    const patientRows: UnifiedRow[] = patients.map((p) => ({
      type: "patient",
      id: p.id,
      name: p.name,
      subId: p.id,
      typeLabel: "Patient",
      modality: "—",
      status: "Active",
    }));
    const studyRows: UnifiedRow[] = studies.map((s) => ({
      type: "study",
      id: s.id,
      name: s.description,
      subId: s.id,
      typeLabel: "MRI",
      modality: "MRI",
      status: s.status ?? "Pending",
    }));

    if (activeTab === "patients") return patientRows;
    if (activeTab === "studies") return studyRows;
    return [...patientRows, ...studyRows];
  }, [patients, studies, activeTab]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return unifiedRows;
    const q = search.toLowerCase();
    return unifiedRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.subId.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [unifiedRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  return (
    <div className="flex flex-1 flex-col">
      <UploadListToolbar
        activeTab={activeTab}
        search={search}
        onTabChange={setActiveTab}
        onSearchChange={setSearch}
        onResetPage={() => setPage(1)}
      />

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Name / ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Type / Info
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Modality
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {paginatedRows.map((row, idx) => (
                <tr
                  key={`${row.type}-${row.id}`}
                  className={
                    idx === 0 && paginatedRows.length > 0
                      ? "bg-emerald-950/30"
                      : "hover:bg-slate-800/50"
                  }
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 rounded-full border border-slate-700 bg-slate-800">
                        <AvatarFallback className="bg-slate-700 text-xs text-slate-300">
                          {row.type === "patient" ? getInitials(row.name) : "ST"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-slate-50">{row.name}</div>
                        <div className="text-xs text-emerald-400/90">{row.subId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">
                    {row.typeLabel}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                    {row.modality}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={statusColor(row.status)}>{row.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={row.type === "patient" ? "/patients" : "/studies"}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-600/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-slate-400 hover:text-slate-200"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 border-slate-800 bg-slate-900"
                        >
                          <DropdownMenuItem className="text-slate-200 focus:bg-slate-800 focus:text-slate-50">
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-300 focus:bg-rose-950/50 focus:text-rose-200">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRows.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No entries found. Try changing the tab or search.
          </div>
        )}
      </div>

      <UploadListPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}

// Backwards-compatible alias
export const UnifiedList = UploadList;

