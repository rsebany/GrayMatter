"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { getStudySliceUrl } from "@/api/clients";

const DEFAULT_MAX_RENDERED_SLICES = 120;
/** Slightly more visible "ghost" planes so the craniocaudal extent reads as 3D volume, not a single sheet. */
const GHOST_OPACITY = 0.32;
const FOCUS_OPACITY = 0.95;

/** DICOM (row, col) spacing in mm, z = distance between stored axial indices. */
export type DicomSpacingMm = { z: number; y: number; x: number };
/** Voxel count (D × H × W) matching slice PNG indexing. */
export type DicomVoxelCount = { depth: number; height: number; width: number };

type Props = {
  studyId: string;
  maxSlices: number;
  currentSlice: number;
  /** World-space X offset; stack is built along local Z. */
  positionX?: number;
  /** Scales the in-plane size of each axial quad. */
  planeScale?: number;
  /**
   * If set with `voxelCount`, quads and stack depth use true mm (lung-like aspect:
   * thin slices vs in-plane FOV) instead of uniform 1.28 squares.
   */
  spacingMm?: DicomSpacingMm;
  /** Must match `maxSlices` and PNG dimensions; enables physical layout when `spacingMm` is set. */
  voxelCount?: DicomVoxelCount;
  /** If false, CT only (no AI overlay on slice PNGs). */
  includeOverlay?: boolean;
  /**
   * Upper bound on how many slice planes to fetch (spaced through the volume).
   * Default 120; use higher in View3D to show a denser stack.
   */
  maxRenderedStackSlices?: number;
};

/**
 * Renders a stack of server-rendered axial DICOM quads in 3D (same /slices API as 2D / XR).
 */
export function DicomAxialStack3D({
  studyId,
  maxSlices,
  currentSlice,
  /** Centered on X by default so the CT stack is the primary 3D focus. */
  positionX = 0,
  planeScale = 1.28,
  spacingMm,
  voxelCount,
  includeOverlay = true,
  maxRenderedStackSlices = DEFAULT_MAX_RENDERED_SLICES,
}: Props) {
  const [entries, setEntries] = useState<Array<{ slice: number; texture: THREE.Texture }>>([]);
  const [loading, setLoading] = useState(false);

  const cap = Math.max(8, maxRenderedStackSlices);
  const sampledSlices = useMemo(() => {
    if (maxSlices <= 0) return [];
    const step = maxSlices <= cap ? 1 : Math.ceil(maxSlices / cap);
    const values = new Set<number>();
    for (let i = 0; i < maxSlices; i += step) values.add(i);
    values.add(maxSlices - 1);
    return Array.from(values).sort((a, b) => a - b);
  }, [maxSlices, maxRenderedStackSlices]);

  useEffect(() => {
    if (!studyId || maxSlices === 0 || sampledSlices.length === 0) {
      setEntries((prev) => {
        prev.forEach(({ texture }) => texture.dispose());
        return [];
      });
      return;
    }

    setLoading(true);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    let cancelled = false;

    const loadTexture = (slice: number) =>
      new Promise<{ slice: number; texture: THREE.Texture }>((resolve, reject) => {
        const url = getStudySliceUrl(studyId, slice, {
          windowCenter: -600,
          windowWidth: 1500,
          orientation: "axial",
          includeOverlay,
        });
        loader.load(
          url,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            resolve({ slice, texture });
          },
          undefined,
          () => reject(new Error(String(slice))),
        );
      });

    Promise.all(sampledSlices.map((s) => loadTexture(s)))
      .then((loaded) => {
        if (cancelled) {
          loaded.forEach(({ texture }) => texture.dispose());
          return;
        }
        setEntries((prev) => {
          prev.forEach(({ texture }) => texture.dispose());
          return loaded;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setEntries((prev) => {
            prev.forEach(({ texture }) => texture.dispose());
            return [];
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studyId, maxSlices, sampledSlices, includeOverlay]);

  const usePhysicalLung =
    Boolean(spacingMm) &&
    Boolean(voxelCount) &&
    (spacingMm?.x ?? 0) > 0 &&
    (spacingMm?.y ?? 0) > 0 &&
    (spacingMm?.z ?? 0) > 0 &&
    (voxelCount?.width ?? 0) > 0 &&
    (voxelCount?.height ?? 0) > 0;

  // Physical: transverse FOV in mm, stack extent along patient Z (axial order).
  let planeW: number;
  let planeH: number;
  let zForSlice: (absSliceIndex: number) => number;
  if (usePhysicalLung && spacingMm && voxelCount) {
    const spx = spacingMm.x;
    const spy = spacingMm.y;
    const spz = spacingMm.z;
    const cols = voxelCount.width;
    const rows = voxelCount.height;
    const fovLrMm = cols * spx;
    const fovApMm = rows * spy;
    const depthSpanMm = Math.max(spz, (maxSlices - 1) * spz);
    const maxMm = Math.max(fovLrMm, fovApMm, depthSpanMm, 0.1);
    const s = 1.35 / maxMm;
    planeW = fovLrMm * s;
    planeH = fovApMm * s;
    const zScale = spz * s;
    const zCenterIndex = (maxSlices - 1) / 2;
    zForSlice = (absSliceIndex: number) => (absSliceIndex - zCenterIndex) * zScale;
  } else {
    const n = Math.max(entries.length, 1);
    const spacingPerSlice =
      n <= 48 ? 0.42 : Math.max(0.1, 18 / Math.max(n - 1, 1));
    const stackDepth = (n - 1) * spacingPerSlice;
    const legacyPlane = planeScale;
    zForSlice = (absSliceIndex: number) => {
      const stackIndex = sampledSlices.indexOf(absSliceIndex);
      if (stackIndex < 0) return 0;
      return stackIndex * spacingPerSlice - stackDepth / 2;
    };
    planeW = legacyPlane;
    planeH = legacyPlane;
  }

  if (maxSlices <= 0) return null;

  return (
    <group position={[positionX, 0, 0]}>
      {loading && entries.length === 0 && (
        <mesh>
          <boxGeometry args={[0.08, 0.4, 0.08]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
        </mesh>
      )}
      {entries.map(({ slice, texture }) => {
        const z = zForSlice(slice);
        const distanceFromCurrent = Math.abs(slice - currentSlice);
        const isFocus = distanceFromCurrent <= 1;
        return (
          <mesh key={slice} position={[0, 0, z]} renderOrder={-1}>
            <planeGeometry args={[planeW, planeH]} />
            <meshBasicMaterial
              map={texture}
              transparent
              opacity={isFocus ? FOCUS_OPACITY : GHOST_OPACITY}
              side={THREE.DoubleSide}
              depthWrite={!isFocus}
            />
          </mesh>
        );
      })}
    </group>
  );
}
