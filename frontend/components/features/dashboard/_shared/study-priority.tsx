import type { ReactNode } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Timer,
} from "lucide-react";

export type StudyPriorityLevel = {
  label: string;
  color: string;
  icon: ReactNode;
};

export function getPriorityLevel(
  status: string,
  hasSegmentation: boolean,
): StudyPriorityLevel {
  const statusLower = status.toLowerCase();

  if (statusLower.includes("critical") || statusLower.includes("urgent")) {
    return {
      label: "URGENT",
      color: "bg-red-500/10 text-red-600 border-red-500/20",
      icon: <AlertCircle className="h-3 w-3" />,
    };
  }
  if (statusLower.includes("complete") || hasSegmentation) {
    return {
      label: "COMPLETE",
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }
  if (statusLower.includes("processing")) {
    return {
      label: "PROCESSING",
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      icon: <Timer className="h-3 w-3" />,
    };
  }
  if (statusLower.includes("pending") || !hasSegmentation) {
    return {
      label: "PENDING",
      color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      icon: <Timer className="h-3 w-3" />,
    };
  }
  return {
    label: "STANDARD",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: <Calendar className="h-3 w-3" />,
  };
}
