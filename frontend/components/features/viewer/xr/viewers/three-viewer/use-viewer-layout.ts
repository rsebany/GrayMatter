"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_MESH_CLASS_VISIBILITY,
  type MeshClassVisibility,
  type MeshVisualPreset,
  type ThreeViewerProps,
} from "../three-viewer.types";
import {
  DICOM_OFFSET_X_DESKTOP,
  DICOM_OFFSET_X_WEBXR,
  MESH_OFFSET_SIDE_BY_SIDE,
  MESH_OFFSET_WEBXR_CENTER,
  MESH_OFFSET_WEBXR_MESH_ONLY,
} from "./constants";

export function useThreeViewerLayout(props: ThreeViewerProps) {
  const {
    meshUrl,
    compareMeshUrl = null,
    meshRotation = [0, 0, 0],
    flipVertical = false,
    usePlaceholder = false,
    showMesh = true,
    dicomContext = null,
    visualPreset = "default",
    classVisibility,
  } = props;

  const [xrPresenting, setXrPresenting] = useState(false);

  const hasDualMeshes =
    showMesh &&
    Boolean(compareMeshUrl?.trim()) &&
    Boolean(meshUrl?.trim()) &&
    !usePlaceholder;
  const showMeshBlock =
    showMesh &&
    (usePlaceholder ||
      hasDualMeshes ||
      (Boolean(meshUrl?.trim()) && !compareMeshUrl?.trim()));

  const resolvedClassVisibility = useMemo(
    () => ({ ...DEFAULT_MESH_CLASS_VISIBILITY, ...(classVisibility ?? {}) }),
    [classVisibility],
  );

  const effectiveMeshRotation = useMemo<[number, number, number]>(() => {
    const [rx, ry, rz] = meshRotation;
    if (!flipVertical) return [rx, ry, rz];
    return [rx + Math.PI, ry, rz];
  }, [meshRotation, flipVertical]);

  const fitKey = `${meshUrl}-${compareMeshUrl ?? ""}-${dicomContext?.studyId ?? ""}-${dicomContext?.maxSlices ?? 0}-m${showMesh ? 1 : 0}-o${props.dicomIncludeOverlay !== false ? 1 : 0}-f${flipVertical ? 1 : 0}`;
  const hasDicomStack = Boolean(dicomContext && dicomContext.maxSlices > 0);

  const dicomPositionX =
    hasDicomStack && xrPresenting ? DICOM_OFFSET_X_WEBXR : DICOM_OFFSET_X_DESKTOP;

  const meshGroupPosition: [number, number, number] = (() => {
    if (!showMeshBlock) return [0, 0, 0];
    if (xrPresenting) {
      return hasDicomStack ? MESH_OFFSET_WEBXR_CENTER : MESH_OFFSET_WEBXR_MESH_ONLY;
    }
    return hasDicomStack ? MESH_OFFSET_SIDE_BY_SIDE : [0, 0, 0];
  })();

  const meshMaterialPreset: MeshVisualPreset =
    xrPresenting && visualPreset === "segmentationWhite" ? "default" : visualPreset;
  const useStudioWhiteLighting =
    visualPreset === "segmentationWhite" && !xrPresenting;
  const useAnatomicalLighting =
    (visualPreset === "anatomicalBrain" ||
      visualPreset === "anatomicalBrainSemi") &&
    !xrPresenting;

  return {
    xrPresenting,
    setXrPresenting,
    hasDualMeshes,
    showMeshBlock,
    resolvedClassVisibility,
    effectiveMeshRotation,
    fitKey,
    hasDicomStack,
    dicomPositionX,
    meshGroupPosition,
    meshMaterialPreset,
    useStudioWhiteLighting,
    useAnatomicalLighting,
  };
}
