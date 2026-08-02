import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearNotifications,
  createNotification,
  deleteNotification,
  listNotifications,
  markNotificationRead,
  type ListNotificationsParams,
} from "@/api/clients";
import type {
  Notification,
  NotificationCreate,
  NotificationListResponse,
} from "@/api/domain";

export function useNotificationsList(options: ListNotificationsParams = {}) {
  return useQuery<NotificationListResponse>({
    queryKey: ["notifications", options],
    queryFn: () => listNotifications(options),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation<{ ok: boolean }, Error, number>({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation<Notification, Error, NotificationCreate>({
    mutationFn: createNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation<{ ok: boolean }, Error, number>({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useClearNotifications() {
  const queryClient = useQueryClient();

  return useMutation<{ ok: boolean; deleted: number }, Error>({
    mutationFn: clearNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotifications(options: ListNotificationsParams = {}) {
  const { data, ...queryRest } = useNotificationsList(options);
  const markMutation = useMarkNotificationRead();
  const deleteMutation = useDeleteNotification();
  const clearMutation = useClearNotifications();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  async function markAsRead(id: number) {
    await markMutation.mutateAsync(id);
  }

  async function removeNotification(id: number) {
    await deleteMutation.mutateAsync(id);
  }

  async function clearAllNotifications() {
    await clearMutation.mutateAsync();
  }

  return {
    notifications,
    unreadCount,
    markAsRead,
    removeNotification,
    clearAllNotifications,
    query: queryRest,
    markMutation,
    deleteMutation,
    clearMutation,
  };
}
