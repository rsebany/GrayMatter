import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type UploadListPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function UploadListPagination({
  currentPage,
  totalPages,
  onPageChange,
}: UploadListPaginationProps) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-400">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1 px-2">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let page = currentPage;
            if (totalPages <= 5) page = i + 1;
            else if (currentPage <= 3) page = i + 1;
            else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
            else page = currentPage - 2 + i;
            return (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="icon"
                className={`h-10 w-10 ${
                  page === currentPage
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
