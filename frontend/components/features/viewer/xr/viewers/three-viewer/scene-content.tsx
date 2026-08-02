"use client";

import React, { Suspense } from "react";
import type * as THREE from "three";
import { DicomAxialStack3D } from "@/components/features/viewer/view3d/DicomAxialStack3D";
import { GltfMeshNoCamera, ProceduralBrain } from "../mesh";
import type { MeshClassVisibility, MeshVisualPreset, ThreeViewerProps } from "../three-viewer.types";

type SceneContentProps = Pick<
  ThreeViewerProps,
  | "meshUrl"
  | "compareMeshUrl"
  | "comparePrimaryPosition"
  | "compareSecondaryPosition"
  | "dicomContext"
  | "dicomIncludeOverlay"
  | "dicomMaxStackSlices"
  | "dicomVoxelCount"
  | "dicomSpacingMm"
  | "usePlaceholder"
> & {
  sceneGroupRef: React.RefObject<THREE.Group | null>;
  hasDualMeshes: boolean;
  showMeshBlock: boolean;
  dicomPositionX: number;
  meshGroupPosition: [number, number, number];
  effectiveMeshRotation: [number, number, number];
  meshMaterialPreset: MeshVisualPreset;
  resolvedClassVisibility: Required<MeshClassVisibility>;
};

export function ThreeViewerScene({
  sceneGroupRef,
  dicomContext,
  dicomIncludeOverlay = true,
  dicomMaxStackSlices,
  dicomVoxelCount = null,
  dicomSpacingMm = null,
  dicomPositionX,
  showMeshBlock,
  hasDualMeshes,
  meshUrl,
  compareMeshUrl,
  comparePrimaryPosition = [-0.38, 0, 0],
  compareSecondaryPosition = [0.38, 0, 0],
  meshGroupPosition,
  effectiveMeshRotation,
  usePlaceholder = false,
  meshMaterialPreset,
  resolvedClassVisibility,
}: SceneContentProps) {
  return (
    <group ref={sceneGroupRef}>
      {dicomContext && dicomContext.maxSlices > 0 && (
        <DicomAxialStack3D
          studyId={dicomContext.studyId}
          maxSlices={dicomContext.maxSlices}
          currentSlice={dicomContext.currentSlice}
          positionX={dicomPositionX}
          planeScale={1.3}
          includeOverlay={dicomIncludeOverlay}
          maxRenderedStackSlices={dicomMaxStackSlices}
          spacingMm={dicomSpacingMm ?? undefined}
          voxelCount={dicomVoxelCount ?? undefined}
        />
      )}
      {showMeshBlock && (
        <>
          {hasDualMeshes ? (
            <>
              <group position={comparePrimaryPosition} rotation={effectiveMeshRotation}>
                <Suspense fallback={null}>
                  <GltfMeshNoCamera
                    meshUrl={meshUrl}
                    visualPreset={meshMaterialPreset}
                    classVisibility={resolvedClassVisibility}
                  />
                </Suspense>
              </group>
              <group position={compareSecondaryPosition} rotation={effectiveMeshRotation}>
                <Suspense fallback={null}>
                  <GltfMeshNoCamera
                    meshUrl={compareMeshUrl!}
                    visualPreset={meshMaterialPreset}
                    classVisibility={resolvedClassVisibility}
                  />
                </Suspense>
              </group>
            </>
          ) : (
            <group position={meshGroupPosition} rotation={effectiveMeshRotation}>
              <Suspense fallback={null}>
                {usePlaceholder ? (
                  <ProceduralBrain />
                ) : (
                  <GltfMeshNoCamera
                    meshUrl={meshUrl}
                    visualPreset={meshMaterialPreset}
                    classVisibility={resolvedClassVisibility}
                  />
                )}
              </Suspense>
            </group>
          )}
        </>
      )}
    </group>
  );
}
