import type { UserRole } from "@/api/domain";
import { useAuth } from "@/contexts/auth-context";

const ADMIN_ROLES: UserRole[] = ["admin", "superadmin", "radiologist"];

/** Mirrors `backend-api/auth/roles.py` (radiologists bypass via product policy). */
const ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin: {
    user_management: true,
    system_maintenance: true,
  },
  referring_physician: {
    user_management: false,
    system_maintenance: false,
  },
  radiologist: {
    user_management: false,
    system_maintenance: false,
  },
};

export function useRole() {
  const { user } = useAuth();
  const role = user?.role;

  const isAdmin = role ? ADMIN_ROLES.includes(role) : false;
  const isSystemAdmin = role === "admin";

  function can(permission: string): boolean {
    if (!user || !role) return false;
    // Admins and radiologists have full workspace access.
    if (role === "radiologist" || role === "admin") return true;
    return ROLE_PERMISSIONS[role]?.[permission] ?? false;
  }

  return { role, isAdmin, isSystemAdmin, can };
}
