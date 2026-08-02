/**
 * Practitioner settings — notifications, default viewer, volume units, PACS.
 */
"use client";

import { WorkspaceShell } from "@/components/layout";
import { SettingsPanel } from "@/components/features/settings/SettingsPanel";

export default function DashboardSettingsPage() {
  return (
    <WorkspaceShell
      activePage="settings"
      title="Settings"
      breadcrumb="Dashboard / Settings"
      mainClassName="flex flex-1 flex-col p-3 sm:p-4 md:p-6"
    >
      <SettingsPanel />
    </WorkspaceShell>
  );
}
