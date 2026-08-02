"use client";

import { useEffect, useState } from "react";

type MaskShape = [number, number, number];

type UseMaskProcessorResult = {
  slices: Uint8Array[] | null;
  shape: MaskShape | null;
  /** Index of the slice with the highest disease voxel count, or null if none. */
  maxDiseaseSliceIndex: number | null;
};

/**
 * Converts a flat mask volume into per-axial-slice arrays and the slice with
 * the highest ILD voxel count.
 */
export function useMaskProcessor(
  rawMask: Uint8Array | null,
  shape: MaskShape | null,
): UseMaskProcessorResult {
  const [slices, setSlices] = useState<Uint8Array[] | null>(null);
  const [computedShape, setComputedShape] = useState<MaskShape | null>(null);
  const [maxDiseaseSliceIndex, setMaxDiseaseSliceIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!rawMask || !shape) {
      setSlices(null);
      setComputedShape(null);
      setMaxDiseaseSliceIndex(null);
      return;
    }

    const [d, h, w] = shape;
    const sliceSize = h * w;
    if (rawMask.length !== d * sliceSize) {
      setSlices(null);
      setComputedShape(null);
      setMaxDiseaseSliceIndex(null);
      return;
    }

    const nextSlices: Uint8Array[] = [];
    let bestIndex = 0;
    let bestCount = 0;

    for (let z = 0; z < d; z++) {
      const slice = rawMask.subarray(z * sliceSize, (z + 1) * sliceSize);
      nextSlices.push(slice);

      let count = 0;
      for (let i = 0; i < slice.length; i++) {
        if (slice[i] > 0) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        bestIndex = z;
      }
    }

    setSlices(nextSlices);
    setComputedShape(shape);
    setMaxDiseaseSliceIndex(bestCount > 0 ? bestIndex : 0);
  }, [rawMask, shape]);

  return { slices, shape: computedShape, maxDiseaseSliceIndex };
}
