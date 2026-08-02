"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";

import type { AdminUserListItem } from "@/api/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading";
import { GrayMatterPanel } from "@/components/layout";
import { AdminUserFormDialog } from "./AdminUserFormDialog";
import {
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
} from "@/hooks/admin";
import { useAuth } from "@/contexts/auth-context";

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

export function AdminUsersPageContent() {
  const { user: currentUser } = useAuth();
  const { data, isLoading, isError, error, refetch } = useAdminUsers();
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(
    null,
  );

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

  const openCreateDialog = () => {
    setDialogMode("create");
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const openEditDialog = (user: AdminUserListItem) => {
    setDialogMode("edit");
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: {
    full_name: string;
    email: string;
    role: string;
    password?: string;
  }) => {
    if (dialogMode === "create") {
      if (!values.password) return;
      await createUser.mutateAsync({
        full_name: values.full_name,
        email: values.email,
        role: values.role,
        password: values.password,
      });
    } else if (selectedUser) {
      await updateUser.mutateAsync({
        userId: selectedUser.id,
        body: {
          full_name: values.full_name,
          email: values.email,
          role: values.role,
          password: values.password,
        },
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = async (user: AdminUserListItem) => {
    const confirmed = window.confirm(
      `Delete ${user.full_name} (${user.email})? This cannot be undone.`,
    );
    if (!confirmed) return;
    await deleteUser.mutateAsync(user.id);
  };

  const isSaving = createUser.isPending || updateUser.isPending;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <GrayMatterPanel title="Manage Users" icon={Users} className="max-w-none">
        <p className="mb-4 text-sm text-muted-foreground">
          Create, update, and remove practitioner accounts. Only system admins
          can access this page.
        </p>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search name, email, ID, role…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-graymatter-border bg-muted/30 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Filter users"
            />
          </div>
          <Button type="button" onClick={openCreateDialog}>
            <Plus />
            Create user
          </Button>
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
          <UsersTable
            rows={users}
            total={data?.length ?? 0}
            currentUserId={currentUser?.id}
            onEdit={openEditDialog}
            onDelete={handleDelete}
            isDeleting={deleteUser.isPending}
          />
        )}
      </GrayMatterPanel>

      <AdminUserFormDialog
        open={dialogOpen}
        mode={dialogMode}
        user={selectedUser}
        isSubmitting={isSaving}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function UsersTable({
  rows,
  total,
  currentUserId,
  onEdit,
  onDelete,
  isDeleting,
}: {
  rows: AdminUserListItem[];
  total: number;
  currentUserId?: number;
  onEdit: (user: AdminUserListItem) => void;
  onDelete: (user: AdminUserListItem) => void;
  isDeleting: boolean;
}) {
  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No accounts yet. Create the first user with the button above.
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
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-graymatter-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Medical ID</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((user) => {
            const isSelf = currentUserId === user.id;
            return (
              <tr
                key={user.id}
                className="border-b border-graymatter-border/60 last:border-0 hover:bg-muted/20"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {user.full_name}
                  {isSelf ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3 font-mono text-xs">{user.medical_id}</td>
                <td className="px-4 py-3">
                  <Badge variant={roleBadgeVariant(user.role)}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(user)}
                    >
                      <Pencil />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(user)}
                      disabled={isSelf || isDeleting}
                      title={isSelf ? "You cannot delete your own account" : undefined}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
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
