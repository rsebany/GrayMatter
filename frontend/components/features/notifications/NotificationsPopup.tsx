"use client";

import React from "react";
import { Bell, CheckCircle2, Info, Trash2, X, Zap } from "lucide-react";

import type { Notification } from "@/api/domain";
import { cn } from "@/lib/utils";

type NotificationsPopupProps = {
  open: boolean;
  onClose: () => void;
  unreadCount: number;
  notifications: Notification[];
  isLoading: boolean;
  isError: boolean;
  markAsRead: (id: number) => Promise<void>;
  removeNotification: (id: number) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  isDeleting: boolean;
  isClearing: boolean;
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  analysis: CheckCircle2,
  system: Zap,
  info: Info,
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function NotificationsPopup({
  open,
  onClose,
  unreadCount,
  notifications,
  isLoading,
  isError,
  markAsRead,
  removeNotification,
  clearAllNotifications,
  isDeleting,
  isClearing,
}: NotificationsPopupProps) {
  if (!open) return null;

  const handleOpenNotification = async (id: number, readAt: string | null | undefined) => {
    if (!readAt) {
      await markAsRead(id);
    }
  };

  const handleRemoveNotification = async (id: number) => {
    await removeNotification(id);
  };

  const handleClearAll = async () => {
    const confirmed = window.confirm(
      "Remove all notifications? This action cannot be undone.",
    );
    if (!confirmed) {
      return;
    }
    await clearAllNotifications();
  };

  return (
    <>
      <div className="fixed inset-0 z-10" aria-hidden="true" onClick={onClose} />
      <div
        className="absolute right-0 z-20 mt-2 w-[22rem] rounded-lg border border-graymatter-border bg-card py-1 shadow-lg"
        role="menu"
      >
        <div className="flex items-start justify-between gap-2 border-b border-graymatter-border px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {notifications.length} total
              {unreadCount > 0 ? ` • ${unreadCount} unread` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={notifications.length === 0 || isClearing}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Remove all notifications"
              title="Remove all notifications"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close notifications popup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Loading notifications...
            </div>
          ) : isError ? (
            <div className="px-3 py-8 text-center text-xs text-destructive">
              Could not load notifications
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = typeIcons[notification.type] ?? Bell;
              const isUnread = !notification.read_at;

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "group flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-muted/70",
                    isUnread && "bg-muted/30",
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenNotification(notification.id, notification.read_at)
                    }
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    role="menuitem"
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        notification.type === "analysis"
                          ? "text-graymatter-accent"
                          : "text-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs font-medium",
                          isUnread ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {notification.message}
                        </p>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveNotification(notification.id)}
                    disabled={isDeleting || isClearing}
                    className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Remove notification ${notification.title}`}
                    title="Remove notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
