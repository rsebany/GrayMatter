import type React from "react";
import type { VolumeDisplayUnit } from "@/lib/metrics/volume-display-unit";

export type TabId = "notifications" | "display" | "integrations";

export type TabConfig = {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NotificationSettingsState = {
  emailOnAnalysis: boolean;
  inAppAlerts: boolean;
  setEmailOnAnalysis: (next: boolean) => void;
  setInAppAlerts: (next: boolean) => void;
};

export type DisplaySettingsState = {
  defaultView: "2d" | "3d";
  volumeUnit: VolumeDisplayUnit;
  setDefaultView: (next: "2d" | "3d") => void;
  setVolumeUnit: (next: VolumeDisplayUnit) => void;
};

export type IntegrationSettingsState = {
  pacsEndpoint: string;
  pacsApiKey: string;
  setPacsEndpoint: (next: string) => void;
  setPacsApiKey: (next: string) => void;
};
