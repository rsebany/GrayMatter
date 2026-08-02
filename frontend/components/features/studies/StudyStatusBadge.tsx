"use client";

import { Badge } from "@/components/ui/badge";

type Props = {
  status: "Completed" | "Processing" | "Pending";
};

export function StudyStatusBadge({ status }: Props) {
  const isCompleted = status === "Completed";
  return (
    <Badge
      className={
        isCompleted
          ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          : "bg-amber-500/10 text-amber-400 animate-pulse"
      }
    >
      {isCompleted ? "Analyzed" : "Processing..."}
    </Badge>
  );
}

