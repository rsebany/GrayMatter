import { useEffect, useState } from "react";

import type { StudyMetrics } from "@/api/domain";
import { useStudyArchitectures } from "./use-studies";

export function useArchitectureSelection(metrics?: StudyMetrics | null) {
  const { data: architectures = [], isLoading: architecturesLoading } =
    useStudyArchitectures();
  const [selectedArchitectureId, setSelectedArchitectureId] = useState("");

  useEffect(() => {
    if (!architectures.length) return;
    setSelectedArchitectureId((current) => {
      if (current && architectures.some((item) => item.id === current)) {
        return current;
      }
      const fromMetrics = metrics?.architecture_id;
      if (fromMetrics && architectures.some((item) => item.id === fromMetrics)) {
        return fromMetrics;
      }
      const defaultArch =
        architectures.find((item) => item.is_default) ?? architectures[0];
      return defaultArch.id;
    });
  }, [architectures, metrics?.architecture_id]);

  return {
    architectures,
    architecturesLoading,
    selectedArchitectureId,
    setSelectedArchitectureId,
    activeArchitectureLabel: metrics?.architecture_label ?? null,
  };
}
