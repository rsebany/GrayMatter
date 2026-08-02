"use client";

import { useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NavHeader } from "@/components/layout/nav-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { AppSidebarPage } from "@/api/domain";

export type WorkspaceShellProps = {
  activePage: AppSidebarPage;
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  children: ReactNode;
  /** Applied to `<main>` (default matches most dashboard routes). */
  mainClassName?: string;
};

const DEFAULT_MAIN_CLASS =
  "flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 md:gap-6 md:p-6";

export function WorkspaceShell({
  activePage,
  title,
  subtitle,
  breadcrumb,
  children,
  mainClassName = DEFAULT_MAIN_CLASS,
}: WorkspaceShellProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <SidebarProvider>
      <AppSidebar activePage={activePage} />
      <SidebarInset>
        <div className="flex min-h-dvh min-w-0 flex-col bg-background">
          <NavHeader
            userMenuOpen={userMenuOpen}
            onUserMenuToggle={() => setUserMenuOpen((v) => !v)}
            title={title}
            subtitle={subtitle}
            breadcrumb={breadcrumb}
          />
          <main className={mainClassName}>{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
