"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getSegmentationSyncStatus,
  listSegmentationRevisions,
  rollbackSegmentationRevision,
} from "@/api/clients";
import type {
  SegmentationRollbackRequest,
  SegmentationSyncStatus,
} from "@/api/domain";

export const segmentationSyncKeys = {
  status: (studyId: string) => ["studies", "segmentation-sync", studyId, "status"] as const,
  revisions: (studyId: string) =>
    ["studies", "segmentation-sync", studyId, "revisions"] as const,
};

export function useSegmentationSyncStatus(studyId: string | undefined) {
  return useQuery<SegmentationSyncStatus>({
    queryKey: segmentationSyncKeys.status(studyId ?? ""),
    queryFn: () => getSegmentationSyncStatus(studyId as string),
    enabled: Boolean(studyId),
  });
}

export function useSegmentationRevisions(studyId: string | undefined) {
  return useQuery({
    queryKey: segmentationSyncKeys.revisions(studyId ?? ""),
    queryFn: () => listSegmentationRevisions(studyId as string),
    enabled: Boolean(studyId),
  });
}

export function useRollbackSegmentationRevision(studyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      revisionId,
      payload,
    }: {
      revisionId: number;
      payload?: SegmentationRollbackRequest;
    }) => rollbackSegmentationRevision(studyId as string, revisionId, payload),
    onSuccess: async () => {
      if (!studyId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: segmentationSyncKeys.status(studyId) }),
        queryClient.invalidateQueries({ queryKey: segmentationSyncKeys.revisions(studyId) }),
        queryClient.invalidateQueries({ queryKey: ["studies", "metrics", studyId] }),
        queryClient.invalidateQueries({ queryKey: ["studies"] }),
      ]);
    },
  });
}
