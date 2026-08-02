import { useQuery } from "@tanstack/react-query";

import { fetchHealth } from "@/api/clients/admin-client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: 60_000,
  });
}
