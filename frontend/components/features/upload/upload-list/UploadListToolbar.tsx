import Link from "next/link";
import { Activity, Search, UploadCloud, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LIST_TABS } from "./upload-list-utils";

type ListTab = "all" | "patients" | "studies";

type UploadListToolbarProps = {
  activeTab: ListTab;
  search: string;
  onTabChange: (tab: ListTab) => void;
  onSearchChange: (value: string) => void;
  onResetPage: () => void;
};

export function UploadListToolbar({
  activeTab,
  search,
  onTabChange,
  onSearchChange,
  onResetPage,
}: UploadListToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-slate-800 pb-3 md:flex-row md:items-center md:justify-between">
      <nav className="flex gap-4 sm:gap-6" aria-label="Tabs">
        {LIST_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              onTabChange(id);
              onResetPage();
            }}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === id
                ? "border-emerald-500 text-slate-50"
                : "border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => {
              onSearchChange(e.target.value);
              onResetPage();
            }}
            className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-9 pr-3 text-sm text-slate-50 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 sm:w-64"
          />
        </div>
        <Link href="/upload-dicom">
          <Button
            variant="outline"
            className="gap-2 border-emerald-600/60 bg-slate-900/80 text-emerald-300 hover:bg-emerald-900/30"
          >
            <UploadCloud className="h-4 w-4" />
            Upload DICOM
          </Button>
        </Link>
        <Link href={activeTab === "studies" ? "/studies" : "/patients"}>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {activeTab === "studies" ? (
              <>
                <Activity className="h-4 w-4" />
                Create Study
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Add Patient
              </>
            )}
          </Button>
        </Link>
      </div>
    </div>
  );
}
