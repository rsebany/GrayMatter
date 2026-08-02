import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listStudies, getStudyMetrics, deleteStudy, listStudyArchitectures } from "@/api/clients";
import type { ArchitectureOption, StudyListItem, StudyMetrics } from "@/api/domain";

function coerceStudies(value: unknown): StudyListItem[] {
  if (Array.isArray(value)) return value as StudyListItem[];
  if (value && typeof value === "object") {
    const wrapped = value as { items?: unknown; data?: unknown; results?: unknown };
    if (Array.isArray(wrapped.items)) return wrapped.items as StudyListItem[];
    if (Array.isArray(wrapped.data)) return wrapped.data as StudyListItem[];
    if (Array.isArray(wrapped.results)) return wrapped.results as StudyListItem[];
  }
  return [];
}

export function useStudiesList() {
  return useQuery<unknown, Error, StudyListItem[]>({
    queryKey: ["studies"],
    queryFn: listStudies,
    select: coerceStudies,
  });
}

export function useStudyMetrics(studyId: string | undefined) {
  return useQuery<StudyMetrics>({
    queryKey: ["studies", "metrics", studyId],
    queryFn: () => getStudyMetrics(studyId as string),
    enabled: !!studyId,
  });
}

export function useStudyArchitectures() {
  return useQuery<ArchitectureOption[]>({
    queryKey: ["studies", "architectures"],
    queryFn: listStudyArchitectures,
    staleTime: 5 * 60 * 1000,
  });
}

/** Shorthand for `useStudiesList`. */
export function useStudies() {
  return useStudiesList();
}

export function useDeleteStudy() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
