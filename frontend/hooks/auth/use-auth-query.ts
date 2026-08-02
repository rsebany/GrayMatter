import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/api/clients";
import type { User } from "@/api/domain";

export function useAuthQuery(enabled: boolean = true) {
  return useQuery<User>({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    enabled,
  });
}
