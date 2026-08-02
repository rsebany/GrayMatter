"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import type { AdminUserListItem } from "@/api/domain";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading";
import { GrayMatterPanel } from "@/components/layout";
import { useAdminUsers } from "@/hooks/admin";

const ROLE_LABELS: Record<string, string> = {
  radiologist: "Radiologist",
  referring_physician: "Referring",
  admin: "Admin",
};

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  if (role === "admin") return "default";
  if (role === "radiologist") return "secondary";
  return "outline";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function AdminUsersTable() {
  const { data, isLoading, isError, error, refetch } = useAdminUsers();
  const [filter, setFilter] = useState("");

  const users = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.medical_id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [data, filter]);

  return (
    <GrayMatterPanel title="Practitioner Accounts" icon={Users} className="max-w-none">
      <p className="mb-4 text-sm text-muted-foreground">
        Read-only directory from the database. Create accounts and reset passwords
        using the CLI commands below — passwords are never sent over HTTP.
      </p>

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search name, email, ID, role…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-10 w-full rounded-lg border border-graymatter-border bg-muted/30 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Filter users"
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading users…" className="h-32" />
      ) : isError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <p className="mb-2">
            {error instanceof Error
              ? error.message
              : "Could not load users. Sign in as an admin account."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : (
        <UserTable rows={users} total={data?.length ?? 0} />
      )}
    </GrayMatterPanel>
  );
}

function UserTable({
  rows,
  total,
}: {
  rows: AdminUserListItem[];
  total: number;
}) {
  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No accounts yet. Create the first admin from{" "}
        <code className="rounded bg-muted px-1">backend-api</code>:
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No users match your search.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-graymatter-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-graymatter-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Medical ID</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr
              key={u.id}
              className="border-b border-graymatter-border/60 last:border-0 hover:bg-muted/20"
            >
              <td className="px-4 py-3 font-medium text-foreground">{u.full_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
              <td className="px-4 py-3 font-mono text-xs">{u.medical_id}</td>
              <td className="px-4 py-3">
                <Badge variant={roleBadgeVariant(u.role)}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {formatDate(u.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-muted-foreground">
        {rows.length === total
          ? `${total} account(s)`
          : `${rows.length} of ${total} shown`}
      </p>
    </div>
  );
}
