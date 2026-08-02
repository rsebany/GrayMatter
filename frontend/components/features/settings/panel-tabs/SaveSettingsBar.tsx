import { CheckCircle2, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

type SaveSettingsBarProps = {
  isSaving: boolean;
  saved: boolean;
  onSave: () => void;
};

export function SaveSettingsBar({
  isSaving,
  saved,
  onSave,
}: SaveSettingsBarProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-graymatter-border bg-graymatter-card px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Changes are saved to your account when you click Save.
      </p>
      <Button onClick={onSave} disabled={isSaving} className="graymatter-cta gap-2">
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {isSaving ? "Saving..." : saved ? "Saved" : "Save Settings"}
      </Button>
    </div>
  );
}
