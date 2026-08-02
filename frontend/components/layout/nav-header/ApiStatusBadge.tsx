import { Server } from "lucide-react";

type ApiHealthUiStatus = "checking" | "online" | "offline";

type ApiStatusBadgeProps = {
  apiUi: ApiHealthUiStatus;
};

export function ApiStatusBadge({ apiUi }: ApiStatusBadgeProps) {
  return (
    <div
      className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex ${
        apiUi === "online"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : apiUi === "offline"
            ? "border-destructive/25 bg-destructive/10 text-destructive"
            : "border-border bg-muted/60 text-muted-foreground"
      }`}
      title="Backend API status"
    >
      <Server className="h-3 w-3 shrink-0" />
      <span className="max-w-[7rem] truncate">
        {apiUi === "checking" && "API ..."}
        {apiUi === "online" && "Online"}
        {apiUi === "offline" && "Offline"}
      </span>
    </div>
  );
}
