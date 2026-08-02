"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import type { AdminCliCommand } from "./admin-cli-commands";

type Props = {
  entry: AdminCliCommand;
};

export function AdminCommandBlock({ entry }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.command);
      setCopied(true);
      notify.success("Command copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="rounded-xl border border-graymatter-border bg-muted/20 p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{entry.title}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="shrink-0 border-graymatter-border"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Copy
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-background/80 px-3 py-2 font-mono text-xs text-foreground">
        {entry.command}
      </pre>
    </div>
  );
}
