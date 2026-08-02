import Link from "next/link";
import { ChevronDown, Shield, User, UserCog } from "lucide-react";

import { useRole } from "@/hooks/app";

type UserMenuProps = {
  open: boolean;
  userName: string;
  onToggle: () => void;
  onLogout: () => void;
};

export function UserMenu({ open, userName, onToggle, onLogout }: UserMenuProps) {
  const { isSystemAdmin } = useRole();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-muted/70 px-2.5 text-sm hover:bg-muted sm:gap-2 sm:px-3"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <User className="h-4 w-4 text-primary" />
        <span className="hidden text-xs font-medium text-foreground sm:inline">
          {userName}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={onToggle} />
          <div
            className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-border bg-card py-1 text-xs shadow-lg"
            role="menu"
          >
            {isSystemAdmin && (
              <>
                <Link
                  href="/dashboard/admin"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-foreground hover:bg-muted/70"
                  role="menuitem"
                  onClick={onToggle}
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin Dashboard
                </Link>
                <Link
                  href="/admin/users"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-foreground hover:bg-muted/70"
                  role="menuitem"
                  onClick={onToggle}
                >
                  <UserCog className="h-3.5 w-3.5" />
                  Manage Users
                </Link>
              </>
            )}
            <Link
              href="/settings"
              className="flex w-full items-center px-3 py-1.5 text-left text-foreground hover:bg-muted/70"
              role="menuitem"
              onClick={onToggle}
            >
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-3 py-1.5 text-left text-foreground hover:bg-muted/70"
              onClick={onLogout}
            >
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
