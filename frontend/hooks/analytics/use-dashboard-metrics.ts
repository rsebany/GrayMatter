import { useQuery } from "@tanstack/react-query";
import { fetchDashboardMetrics } from "@/api/clients";
import type { DashboardMetrics } from "@/api/domain";

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ["analytics", "dashboard-metrics"],
    queryFn: fetchDashboardMetrics,
  });
}
