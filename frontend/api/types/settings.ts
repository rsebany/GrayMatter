/**
 * Practitioner settings types — preferences and PACS integration fields.
 */

// ---------------------------------------------------------------------------
// Units & enums
// ---------------------------------------------------------------------------

/** Segmentation volume display: mm³, cm³, ml, or lung burden %. */
export type VolumeDisplayUnitSetting = "mm" | "cm" | "ml" | "percent";

// ---------------------------------------------------------------------------
// Settings read & write
// ---------------------------------------------------------------------------

export interface PractitionerSettings {
  email_on_analysis: boolean;
  in_app_alerts: boolean;
  default_view: string;
  unit_measurement: VolumeDisplayUnitSetting;
  pacs_api_key?: string | null;
  pacs_endpoint?: string | null;
}

export interface PractitionerSettingsUpdate {
  email_on_analysis?: boolean;
  in_app_alerts?: boolean;
  default_view?: string;
  unit_measurement?: VolumeDisplayUnitSetting;
  pacs_api_key?: string | null;
  pacs_endpoint?: string | null;
}
