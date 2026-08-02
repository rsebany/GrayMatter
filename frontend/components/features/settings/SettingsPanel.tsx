"use client";

import React, { useState } from "react";
import { Bell, Layout, Plug } from "lucide-react";

import { useSettings, useUpdateSettings } from "@/hooks/settings";
import { LoadingState } from "@/components/ui/loading";
import {
  normalizeVolumeDisplayUnit,
  type VolumeDisplayUnit,
} from "@/lib/metrics/volume-display-unit";
import { DisplaySettingsTab } from "@/components/features/settings/panel-tabs/DisplaySettingsTab";
import { IntegrationsSettingsTab } from "@/components/features/settings/panel-tabs/IntegrationsSettingsTab";
import { NotificationsSettingsTab } from "@/components/features/settings/panel-tabs/NotificationsSettingsTab";
import { SaveSettingsBar } from "@/components/features/settings/panel-tabs/SaveSettingsBar";
import { SettingsTabsHeader } from "@/components/features/settings/panel-tabs/SettingsTabsHeader";
import type { TabConfig, TabId } from "@/components/features/settings/panel-tabs/settings-tab-types";

const tabs: TabConfig[] = [
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "display", label: "Display", icon: Layout },
  { id: "integrations", label: "Integrations", icon: Plug },
];

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("notifications");
  const [saved, setSaved] = useState(false);
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const isSaving = updateSettings.isPending;

  const [emailOnAnalysis, setEmailOnAnalysis] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [defaultView, setDefaultView] = useState<"2d" | "3d">("2d");
  const [volumeUnit, setVolumeUnit] = useState<VolumeDisplayUnit>("mm");
  const [pacsApiKey, setPacsApiKey] = useState("");
  const [pacsEndpoint, setPacsEndpoint] = useState("");

  React.useEffect(() => {
    if (settings) {
      setEmailOnAnalysis(settings.email_on_analysis);
      setInAppAlerts(settings.in_app_alerts);
      setDefaultView(
        settings.default_view === "3d"
          ? "3d"
          : settings.default_view === "2d"
          ? "2d"
          : "2d",
      );
      setVolumeUnit(normalizeVolumeDisplayUnit(settings.unit_measurement));
      setPacsApiKey(settings.pacs_api_key ?? "");
      setPacsEndpoint(settings.pacs_endpoint ?? "");
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      email_on_analysis: emailOnAnalysis,
      in_app_alerts: inAppAlerts,
      default_view: defaultView,
      unit_measurement: volumeUnit,
      pacs_api_key: pacsApiKey || null,
      pacs_endpoint: pacsEndpoint || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading || !settings) {
    return (
      <LoadingState
        label="Loading settings…"
        className="h-48"
        iconClassName="h-6 w-6"
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-2xl border border-graymatter-border bg-graymatter-card overflow-hidden">
        <SettingsTabsHeader
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="p-6">
          {activeTab === "notifications" && (
            <NotificationsSettingsTab
              emailOnAnalysis={emailOnAnalysis}
              inAppAlerts={inAppAlerts}
              setEmailOnAnalysis={setEmailOnAnalysis}
              setInAppAlerts={setInAppAlerts}
            />
          )}

          {activeTab === "display" && (
            <DisplaySettingsTab
              defaultView={defaultView}
              volumeUnit={volumeUnit}
              setDefaultView={setDefaultView}
              setVolumeUnit={setVolumeUnit}
            />
          )}

          {activeTab === "integrations" && (
            <IntegrationsSettingsTab
              pacsEndpoint={pacsEndpoint}
              pacsApiKey={pacsApiKey}
              setPacsEndpoint={setPacsEndpoint}
              setPacsApiKey={setPacsApiKey}
            />
          )}
        </div>
      </div>

      <SaveSettingsBar isSaving={isSaving} saved={saved} onSave={handleSave} />
    </div>
  );
}
