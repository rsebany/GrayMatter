"use client";

import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppLogo } from "@/components/layout/app-logo";
import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import { AppSidebarPage } from "@/api/domain";
import { useAuth } from "@/contexts/auth-context";

type AppSidebarProps = {
  activePage: AppSidebarPage;
};

export function AppSidebar({ activePage }: AppSidebarProps) {
  const { state } = useSidebar();
  const { user } = useAuth();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-graymatter-border bg-graymatter-sidebar text-sidebar-foreground"
    >
      <SidebarHeader className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <AppLogo size={24} className="h-6 w-6 shrink-0 object-contain" />
            {state === "expanded" && (
              <span className="truncate text-base font-semibold tracking-wide text-graymatter-accent">
                GrayMatter
              </span>
            )}
          </div>
          {state === "expanded" && (
            <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground" />
          )}
        </div>
        {state === "collapsed" && (
          <div className="flex justify-center pt-1">
            <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground" />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="gap-0 px-1 py-2 text-sm">
        <NavMain activePage={activePage} />
      </SidebarContent>
      {user ? (
        <SidebarFooter className="border-t border-graymatter-border/60 p-2">
          <NavUser
            user={{
              name: user.full_name,
              email: user.email,
              avatar: "",
            }}
          />
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}

export type { AppSidebarPage };
