"use client";

import type { RefObject } from "react";
import * as THREE from "three";
import { BrainMesh } from "@/components/features/viewer/xr/mesh/BrainMesh";
import { MeshHtmlControls } from "./MeshHtmlControls";
import { MeshImmersiveControls } from "./MeshImmersiveControls";
import type { MeshClassVisibility } from "./types";
import { UserLesionMarkers } from "./UserLesionMarkers";

type Props = {
  meshGroupRef: RefObject<THREE.Group | null>;
  meshUrl: string;
  useMeshPlaceholder: boolean;
  solidBrainEnabled: boolean;
  meshGroupPosition: [number, number, number];
  meshScale: number;
  meshDisplayRotation: [number, number, number];
  classVisibility: MeshClassVisibility;
  isPresenting: boolean;
  useHtmlControls: boolean;
  rotateMeshY: (d: 1 | -1) => void;
  resetMeshRotation: () => void;
  flipMesh: () => void;
  onPresetLesions: () => void;
  onAddPanel: () => void;
  onClearPanels: () => void;
  placingLesion: boolean;
  setPlacingLesion: (v: boolean | ((prev: boolean) => boolean)) => void;
  userLesions: Array<{ id: string; position: [number, number, number] }>;
  onClearLesions: () => void;
  onSurfacePick: (worldPoint: THREE.Vector3) => void;
};

export function MeshGroupContent(props: Props) {
  const {
    meshGroupRef, meshUrl, useMeshPlaceholder, solidBrainEnabled, meshGroupPosition, meshScale,
    meshDisplayRotation, classVisibility, isPresenting, useHtmlControls, rotateMeshY,
    resetMeshRotation, flipMesh, onPresetLesions, onAddPanel, onClearPanels, placingLesion,
    setPlacingLesion, userLesions, onClearLesions, onSurfacePick,
  } = props;

  return (
    <group ref={meshGroupRef} position={meshGroupPosition} scale={meshScale} rotation={meshDisplayRotation}>
      <BrainMesh
        meshUrl={meshUrl}
        usePlaceholder={useMeshPlaceholder}
        solidBrainEnabled={solidBrainEnabled}
        classVisibility={classVisibility}
        autoRotate={false}
        allowDrag={false}
        layoutGroupPosition={[0, 0, 0]}
        surfacePickMode={placingLesion}
        onSurfacePick={onSurfacePick}
      />
      <UserLesionMarkers lesions={userLesions} />
      {isPresenting ? (
        <MeshImmersiveControls
          onRotateLeft={() => rotateMeshY(-1)}
          onRotateRight={() => rotateMeshY(1)}
          onResetRotation={resetMeshRotation}
          onFlip={flipMesh}
          onAddPanel={onAddPanel}
          onClearPanels={onClearPanels}
        />
      ) : null}
      {useHtmlControls ? (
        <MeshHtmlControls
          onRotateLeft={() => rotateMeshY(-1)}
          onRotateRight={() => rotateMeshY(1)}
          onFlip={flipMesh}
          onResetRotation={resetMeshRotation}
          onPresetLesions={onPresetLesions}
          placingLesion={placingLesion}
          onTogglePlacing={() => setPlacingLesion((v) => !v)}
          lesionCount={userLesions.length}
          onClearLesions={onClearLesions}
        />
      ) : null}
    </group>
  );
}
