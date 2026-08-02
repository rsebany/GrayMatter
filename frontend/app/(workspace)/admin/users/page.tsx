/**
 * Admin user management — create, edit, and delete practitioner accounts.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AdminUsersPageContent } from "@/components/features/admin";
import { WorkspaceShell } from "@/components/layout";
import { useAuth } from "@/contexts/auth-context";
import { useRole } from "@/hooks/app";

export default function AdminUsersPage() {
  const { isLoading } = useAuth();
  const { isSystemAdmin } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isSystemAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, isSystemAdmin, router]);

  if (isLoading || !isSystemAdmin) {
    return null;
  }

  return (
    <WorkspaceShell
      activePage="admin_users"
      title="Manage Users"
      breadcrumb="Administration / Users"
    >
      <AdminUsersPageContent />
    </WorkspaceShell>
  );
}
