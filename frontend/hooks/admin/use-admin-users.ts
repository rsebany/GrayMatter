import { useQuery } from "@tanstack/react-query";

import { fetchAdminUsers } from "@/api/clients/admin-client";

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
    staleTime: 30_000,
  });
}
