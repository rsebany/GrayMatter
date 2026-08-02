export type WindowPreset = { label: string; center: number; width: number };

/** 0–255 display range for normalized MRI preview volumes. */
export const MRI_WINDOW_PRESETS = {
  brain: { label: "Brain", center: 128, width: 180 },
  bright: { label: "Bright", center: 145, width: 120 },
  wide: { label: "Wide", center: 128, width: 255 },
} as const satisfies Record<string, WindowPreset>;

export type MriWindowPresetKey = keyof typeof MRI_WINDOW_PRESETS;

export function windowPresetsForModality(_modality?: string): Record<string, WindowPreset> {
  return MRI_WINDOW_PRESETS;
}

export function defaultWindowPresetKey(_modality?: string): string {
  return "brain";
}
