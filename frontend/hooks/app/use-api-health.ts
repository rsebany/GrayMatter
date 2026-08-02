import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/http/client";

type HealthPayload = {
  status?: string;
};

/**
 * Shared backend reachability check (same cache for NavHeader, dashboard, etc.).
 */
export function useApiHealth() {
  return useQuery({
    queryKey: ["api-health"],
    queryFn: () => apiFetch<HealthPayload>("/health"),
    retry: 1,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export type ApiHealthUiStatus = "checking" | "online" | "offline";

export function getApiHealthUiStatus(query: {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
}): ApiHealthUiStatus {
  if (query.isPending) return "checking";
  if (query.isError) return "offline";
  if (query.isSuccess) return "online";
  return "checking";
}
