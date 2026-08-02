export const MESH_CLASS_BUTTONS = [
  { key: "left" as const, label: "Left", activeClass: "border-emerald-500/60 text-emerald-100" },
  { key: "right" as const, label: "Right", activeClass: "border-violet-500/60 text-violet-100" },
  { key: "brain_shell" as const, label: "Brain", activeClass: "border-slate-500/70 text-slate-100" },
];

export function meshTissueToggleLabel(solidBrainEnabled: boolean): string {
  return solidBrainEnabled ? "Solid brain" : "Colored inside";
}

export function meshTissueToggleTitle(): string {
  return "Toggle translucent shell with colored hippocampus vs solid brain";
}
