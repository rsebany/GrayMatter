/**
 * 2D/3D viewer panels and reusable XR primitives (`./xr`).
 * Immersive route shell components are under `@/components/xr`.
 */
export { View2DPanel } from "./View2DPanel";
export { View3DReconstructionPanel } from "./View3DReconstructionPanel";
export {
  ImagingWorkspacePage,
  type ImagingWorkspacePageProps,
} from "./ImagingWorkspacePage";

export * from "./expert-compare";
export * from "./pipeline";

export {
  ThreeViewer,
  DEFAULT_MESH_CLASS_VISIBILITY,
  type MeshClassKey,
  type MeshClassVisibility,
  type ThreeViewerProps,
} from "./xr";

export {
  DEFAULT_MESH_CUTAWAY,
  MESH_CUTAWAY_PLANE_NORMAL,
  MeshCutawayControls,
  type MeshCutawayState,
} from "./view3d/MeshCutawayControls";

export type {
  DicomSpacingMm,
  DicomVoxelCount,
} from "./view3d/DicomAxialStack3D";
