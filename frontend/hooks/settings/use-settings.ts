import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "@/api/clients";
import type {
  PractitionerSettings,
  PractitionerSettingsUpdate,
} from "@/api/domain";

export function useSettings() {
  return useQuery<PractitionerSettings>({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation<PractitionerSettings, Error, PractitionerSettingsUpdate>({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
