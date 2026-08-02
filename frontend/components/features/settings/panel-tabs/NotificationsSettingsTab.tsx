import { Switch } from "@/components/ui/switch";
import type { NotificationSettingsState } from "./settings-tab-types";

type NotificationsSettingsTabProps = NotificationSettingsState;

export function NotificationsSettingsTab({
  emailOnAnalysis,
  inAppAlerts,
  setEmailOnAnalysis,
  setInAppAlerts,
}: NotificationsSettingsTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Notification Preferences
        </h3>
        <p className="text-xs text-muted-foreground">
          Choose how GrayMatter informs you about completed analyses and system
          activity.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-graymatter-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            Email on Analysis Completion
          </p>
          <p className="text-xs text-muted-foreground">
            Receive an email when AI segmentation finishes
          </p>
        </div>
        <Switch checked={emailOnAnalysis} onCheckedChange={setEmailOnAnalysis} />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-graymatter-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            In-app System Alerts
          </p>
          <p className="text-xs text-muted-foreground">
            Show notifications in the header when analyses complete
          </p>
        </div>
        <Switch checked={inAppAlerts} onCheckedChange={setInAppAlerts} />
      </div>
    </div>
  );
}
