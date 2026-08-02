"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
} from "lucide-react";
import { useTheme } from "@/components/layout/theme-provider";
import { useNotifications } from "@/hooks/notifications";
import { useAuth } from "@/contexts/auth-context";
import { useConfirm } from "@/components/feedback";
import { notify } from "@/lib/notify";
import { useApiHealth, getApiHealthUiStatus } from "@/hooks/app";
import { NotificationsPopup } from "@/components/features/notifications/NotificationsPopup";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ApiStatusBadge } from "@/components/layout/nav-header/ApiStatusBadge";
import { ThemeToggleButton } from "@/components/layout/nav-header/ThemeToggleButton";
import { UserMenu } from "@/components/layout/nav-header/UserMenu";

type NavHeaderProps = {
  userMenuOpen: boolean;
  onUserMenuToggle: () => void;
  title: string;
  subtitle?: string;
  breadcrumb?: string;
};

export function NavHeader({
  userMenuOpen,
  onUserMenuToggle,
  title,
  subtitle,
  breadcrumb,
}: NavHeaderProps) {
  const { darkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const {
    unreadCount,
    notifications,
    markAsRead,
    removeNotification,
    clearAllNotifications,
    query,
    deleteMutation,
    clearMutation,
  } = useNotifications({ limit: 100 });

  const displayUnreadCount = query.isError ? 0 : unreadCount;

  const healthQuery = useApiHealth();
  const apiUi = getApiHealthUiStatus({
    isPending: healthQuery.isPending,
    isError: healthQuery.isError,
    isSuccess: healthQuery.isSuccess,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node)
      ) {
        setNotificationMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    onUserMenuToggle();
    const ok = await confirm({
      title: "Sign out?",
      description:
        "You will need to sign in again to use the workspace and viewers.",
      confirmText: "Sign out",
      cancelText: "Stay signed in",
    });
    if (!ok) return;
    logout();
    notify.success("Signed out");
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-graymatter-border bg-background px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SidebarTrigger className="md:hidden" />
        <div className="flex min-w-0 flex-col">
          {breadcrumb && (
            <div className="truncate text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {breadcrumb}
            </div>
          )}
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-semibold text-foreground sm:text-sm md:text-base">{title}</h1>
            {subtitle && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                • {subtitle}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <ApiStatusBadge apiUi={apiUi} />

        <ThemeToggleButton darkMode={darkMode} onToggle={toggleTheme} />

        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => setNotificationMenuOpen((v) => !v)}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/70 hover:bg-muted"
            aria-label="Notifications"
            aria-expanded={notificationMenuOpen}
          >
            <Bell className="h-4 w-4 text-primary" />
            {displayUnreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {displayUnreadCount > 99 ? "99+" : displayUnreadCount}
              </span>
            )}
          </button>
          <NotificationsPopup
            open={notificationMenuOpen}
            onClose={() => setNotificationMenuOpen(false)}
            unreadCount={unreadCount}
            notifications={notifications}
            isLoading={query.isLoading}
            isError={query.isError}
            markAsRead={markAsRead}
            removeNotification={removeNotification}
            clearAllNotifications={clearAllNotifications}
            isDeleting={deleteMutation.isPending}
            isClearing={clearMutation.isPending}
          />
        </div>

        <UserMenu
          open={userMenuOpen}
          userName={user?.full_name ?? "User"}
          onToggle={onUserMenuToggle}
          onLogout={handleLogout}
        />
      </div>
    </header>
  );
}
