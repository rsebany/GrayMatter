import type React from "react";

export const HUD_BTN: React.CSSProperties = {
  pointerEvents: "auto",
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid rgba(148,163,184,0.45)",
  background: "rgba(2,6,23,0.74)",
  color: "#e2e8f0",
  fontSize: 20,
  lineHeight: "20px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const HUD_BTN_ACTIVE: React.CSSProperties = {
  ...HUD_BTN,
  border: "1px solid rgba(56,189,248,0.55)",
  background: "rgba(14,116,144,0.35)",
  color: "#bae6fd",
};
