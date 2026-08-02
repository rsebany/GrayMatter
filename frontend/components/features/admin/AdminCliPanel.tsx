"use client";

import { Terminal } from "lucide-react";

import { GrayMatterPanel } from "@/components/layout";
import { AdminCommandBlock } from "./AdminCommandBlock";
import { ADMIN_CLI_COMMANDS } from "./admin-cli-commands";

export function AdminCliPanel() {
  return (
    <GrayMatterPanel title="Account CLI (passwords)" icon={Terminal}>
      <p className="mb-4 text-sm text-muted-foreground">
        Run these from the <code className="rounded bg-muted px-1">backend-api</code>{" "}
        folder with <code className="rounded bg-muted px-1">DATABASE_URL</code> set
        (same environment as the API). Omit{" "}
        <code className="rounded bg-muted px-1">--password</code> to enter a password
        securely at the prompt.
      </p>
      <div className="space-y-3">
        {ADMIN_CLI_COMMANDS.map((entry) => (
          <AdminCommandBlock key={entry.id} entry={entry} />
        ))}
      </div>
    </GrayMatterPanel>
  );
}
