"use client";

import { AdminCliPanel } from "./AdminCliPanel";
import { AdminSystemPanel } from "./AdminSystemPanel";
import { AdminUsersTable } from "./AdminUsersTable";

export function AdminDashboard() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <AdminSystemPanel />
      <AdminUsersTable />
      <AdminCliPanel />
    </div>
  );
}
