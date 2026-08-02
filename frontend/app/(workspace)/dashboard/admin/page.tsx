/**
 * Admin dashboard — system status, user directory, CLI for passwords (admin role only).
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AdminDashboard } from "@/components/features/admin";
import { WorkspaceShell } from "@/components/layout";
import { useRole } from "@/hooks/app";

export default function AdminPage() {
  const { isSystemAdmin } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!isSystemAdmin) {
      router.replace("/dashboard");
    }
  }, [isSystemAdmin, router]);

  if (!isSystemAdmin) {
    return null;
  }

  return (
    <WorkspaceShell
      activePage="admin_dashboard"
      title="System Administration"
      breadcrumb="Administration / Dashboard"
    >
      <AdminDashboard />
    </WorkspaceShell>
  );
}
