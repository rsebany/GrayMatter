/**
 * Immersive XR route shell — VR/AR pages, HUD, toolbars, scene orchestration.
 * Reusable 3D primitives (BrainMesh, ThreeViewer) live under
 * `@/components/features/viewer/xr`.
 */
export { DicomSliceViewer } from "./dicom";
export { XrExperiencePage, type XrExperienceMode } from "./experience";
export { XRSceneContent } from "./scene";
export { XrLabHeader, XrMetricsPanel, XrStatusOverlays, XrImmersiveHud } from "./chrome";
export { XrBottomToolbar, parseXrToolbarDock, type XrToolbarDock } from "./toolbar";
