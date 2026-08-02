"use client";

import { useEffect, useState } from "react";

import type { AdminUserListItem } from "@/api/domain";
import { ADMIN_USER_ROLES } from "@/api/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AdminUserFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  user?: AdminUserListItem | null;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    full_name: string;
    email: string;
    role: string;
    password?: string;
  }) => void;
};

const inputClassName =
  "h-10 w-full rounded-lg border border-graymatter-border bg-muted/30 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function AdminUserFormDialog({
  open,
  mode,
  user,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: AdminUserFormDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("radiologist");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && user) {
      setFullName(user.full_name);
      setEmail(user.email);
      setRole(user.role);
      setPassword("");
      return;
    }
    setFullName("");
    setEmail("");
    setRole("radiologist");
    setPassword("");
  }, [open, mode, user]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      full_name: fullName.trim(),
      email: email.trim(),
      role,
      password: password.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create user" : "Edit user"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a practitioner account with an initial password."
              : "Update account details. Leave password blank to keep the current one."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Full name</span>
            <input
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={inputClassName}
              autoComplete="name"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
              autoComplete="email"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={inputClassName}
            >
              {ADMIN_USER_ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">
              Password{mode === "edit" ? " (optional)" : ""}
            </span>
            <input
              required={mode === "create"}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClassName}
              autoComplete={mode === "create" ? "new-password" : "off"}
              minLength={mode === "create" ? 8 : undefined}
            />
          </label>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : mode === "create"
                  ? "Create user"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
