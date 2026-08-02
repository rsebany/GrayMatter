"use client";

import React, { useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { XRCanvasContainer, XRControls } from "@/components/features/viewer/xr/canvas";
import { XRInteractionLayer } from "@/components/features/viewer/xr/interaction";
import { FitToSceneGroup, type OrbitControlsHandle, XrPresentingSync } from "./three-viewer-camera";
import { ZoomHud } from "./hud/ZoomHud";
import { MAX_DISTANCE, MIN_DISTANCE } from "./three-viewer/constants";
import { ThreeViewerLighting } from "./three-viewer/lighting";
import { ThreeViewerScene } from "./three-viewer/scene-content";
import { useThreeViewerLayout } from "./three-viewer/use-viewer-layout";
import {
  DEFAULT_MESH_CLASS_VISIBILITY,
  type ThreeViewerProps,
} from "./three-viewer.types";

export type {
  DicomContext3D,
  MeshClassKey,
  MeshClassVisibility,
  ThreeViewerProps,
} from "./three-viewer.types";
export { DEFAULT_MESH_CLASS_VISIBILITY } from "./three-viewer.types";

export const ThreeViewer: React.FC<ThreeViewerProps> = (props) => {
  const {
    backgroundColor = "#020617",
    flipVertical = false,
    onFlipVertical,
    visualPreset = "default",
    dicomContext = null,
    dicomIncludeOverlay = true,
    dicomMaxStackSlices,
    dicomVoxelCount = null,
    dicomSpacingMm = null,
    meshUrl,
    compareMeshUrl = null,
    comparePrimaryPosition = [-0.38, 0, 0],
    compareSecondaryPosition = [0.38, 0, 0],
    usePlaceholder = false,
  } = props;

  const sceneGroupRef = useRef<THREE.Group | null>(null);
  const orbitRef = useRef<OrbitControlsHandle | null>(null);
  const layout = useThreeViewerLayout(props);

  const usePhysicalToneMapping =
    visualPreset === "anatomicalBrain" ||
    visualPreset === "anatomicalBrainSemi";

  return (
    <XRCanvasContainer
      backgroundColor={backgroundColor}
      usePhysicalToneMapping={usePhysicalToneMapping}
    >
      <XrPresentingSync onPresentingChange={layout.setXrPresenting} />
      <ThreeViewerLighting
        useStudioWhiteLighting={layout.useStudioWhiteLighting}
        useAnatomicalLighting={layout.useAnatomicalLighting}
      />
      <ThreeViewerScene
        sceneGroupRef={sceneGroupRef}
        dicomContext={dicomContext}
        dicomIncludeOverlay={dicomIncludeOverlay}
        dicomMaxStackSlices={dicomMaxStackSlices}
        dicomVoxelCount={dicomVoxelCount}
        dicomSpacingMm={dicomSpacingMm}
        dicomPositionX={layout.dicomPositionX}
        showMeshBlock={layout.showMeshBlock}
        hasDualMeshes={layout.hasDualMeshes}
        meshUrl={meshUrl}
        compareMeshUrl={compareMeshUrl}
        comparePrimaryPosition={comparePrimaryPosition}
        compareSecondaryPosition={compareSecondaryPosition}
        meshGroupPosition={layout.meshGroupPosition}
        effectiveMeshRotation={layout.effectiveMeshRotation}
        usePlaceholder={usePlaceholder}
        meshMaterialPreset={layout.meshMaterialPreset}
        resolvedClassVisibility={layout.resolvedClassVisibility}
      />
      <FitToSceneGroup
        groupRef={sceneGroupRef}
        resetKey={layout.fitKey}
        controlsRef={orbitRef as React.RefObject<OrbitControlsHandle | null>}
      />
      <OrbitControls
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={orbitRef as any}
        makeDefault
        enabled={!layout.xrPresenting}
        enableZoom
        zoomSpeed={1}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        minPolarAngle={0.2}
        maxPolarAngle={2.85}
        enableDamping
        dampingFactor={0.05}
        target={[0, 0, 0]}
      />
      {!layout.xrPresenting && (
        <ZoomHud
          controlsRef={orbitRef}
          minDistance={MIN_DISTANCE}
          maxDistance={MAX_DISTANCE}
          flipVertical={flipVertical}
          onFlipVertical={onFlipVertical}
          flipVerticalDisabled={!layout.showMeshBlock}
        />
      )}
      <XRInteractionLayer />
      <XRControls />
    </XRCanvasContainer>
  );
};
