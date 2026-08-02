export type AdminCliCommand = {
  id: string;
  title: string;
  description: string;
  command: string;
};

/** Copy-ready examples for `backend-api/scripts/auth/` (run from `backend-api/`). */
export const ADMIN_CLI_COMMANDS: AdminCliCommand[] = [
  {
    id: "create-radiologist",
    title: "Create radiologist",
    description:
      "Adds a full-access practitioner. Omit --password to be prompted securely.",
    command:
      'python scripts/auth/create_user.py --email dr@hospital.example --full-name "Dr. Smith" --role radiologist',
  },
  {
    id: "create-admin",
    title: "Create system admin",
    description: "Admin role: user management and maintenance only (no clinical upload).",
    command:
      'python scripts/auth/create_user.py --email admin@hospital.example --full-name "System Admin" --role admin',
  },
  {
    id: "create-referring",
    title: "Create referring physician",
    description: "Read-only clinical access; shared 3D / metrics.",
    command:
      'python scripts/auth/create_user.py --email ref@hospital.example --full-name "Dr. Referring" --role referring_physician',
  },
  {
    id: "set-password",
    title: "Reset password",
    description: "Updates bcrypt hash for an existing email. Never log the plain password.",
    command: "python scripts/auth/set_password.py --email dr@hospital.example",
  },
  {
    id: "list-users",
    title: "List accounts (CLI)",
    description: "Same data as the table below; use when the API is offline.",
    command: "python scripts/auth/list_users.py",
  },
  {
    id: "list-users-json",
    title: "List accounts (JSON)",
    description: "Machine-readable export for audits or automation.",
    command: "python scripts/auth/list_users.py --format json",
  },
];
