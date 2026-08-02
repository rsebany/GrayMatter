export const LIST_TABS = [
  { id: "all", label: "All" },
  { id: "patients", label: "Patients" },
  { id: "studies", label: "Studies" },
] as const;

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function statusColor(status: string): string {
  if (status === "Analyzed" || status === "Active" || status === "Confirmed") {
    return "text-emerald-400";
  }
  if (status === "Pending" || status === "Not Connected") return "text-amber-400";
  return "text-slate-400";
}
