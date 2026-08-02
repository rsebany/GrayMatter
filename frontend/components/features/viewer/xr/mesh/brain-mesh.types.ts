import type * as THREE from "three";

export type BrainMeshProps = {
  /** Ignored when `usePlaceholder` is true. */
  meshUrl: string;
  /** Procedural mesh (no glTF fetch) when no real mesh URL exists. */
  usePlaceholder?: boolean;
  /** Opaque brain shell; when false, semi-transparent shell with colored hippocampus (default). */
  solidBrainEnabled?: boolean;
  classVisibility?: {
    left: boolean;
    right: boolean;
    brain_shell: boolean;
  };
  /**
   * When set, pointer drag applies world-space deltas here instead of moving the
   * built-in mesh group (used by the XR lab to drag the whole mesh from the parent).
   */
  onWorldDragDelta?: (delta: THREE.Vector3) => void;
  /** Disable idle Y-axis spin to keep mesh static. */
  autoRotate?: boolean;
  /** Pointer / VR grab to move the mesh. */
  allowDrag?: boolean;
  /** Override inner group position (default [0, 1.2, 0.5] for legacy 3D viewer). */
  layoutGroupPosition?: [number, number, number];
  /** Click on the brain surface to place a marker (XR annotation). */
  surfacePickMode?: boolean;
  onSurfacePick?: (worldPoint: THREE.Vector3) => void;
  onLoadError?: (error: Error) => void;
};

export type BrainMeshClippingProps = {
  scene: THREE.Group;
  classVisibility?: BrainMeshProps["classVisibility"];
};
