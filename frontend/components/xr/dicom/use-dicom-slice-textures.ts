"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getStudySliceUrl } from "@/api/clients";
import { createSliceTextureCache } from "./slice-texture-cache";

export function useDicomSliceTextures(studyId: string, maxSlices: number, currentSlice: number) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(false);
  const loaderRef = useRef<THREE.TextureLoader | null>(null);
  const storeRef = useRef(createSliceTextureCache());
  const latestRequestRef = useRef(0);

  const buildSliceUrl = useCallback(
    (slice: number) =>
      getStudySliceUrl(studyId, slice, {
        windowCenter: -600,
        windowWidth: 1500,
        orientation: "axial",
        includeOverlay: true,
      }),
    [studyId],
  );

  const loadSliceTexture = useCallback(
    (slice: number): Promise<THREE.Texture> => {
      const store = storeRef.current;
      const cached = store.cache.get(slice);
      if (cached) {
        store.touchLru(slice);
        return Promise.resolve(cached);
      }
      const existing = store.pending.get(slice);
      if (existing) return existing;

      if (!loaderRef.current) {
        loaderRef.current = new THREE.TextureLoader();
        loaderRef.current.setCrossOrigin("anonymous");
      }

      const promise = new Promise<THREE.Texture>((resolve, reject) => {
        loaderRef.current!.load(
          buildSliceUrl(slice),
          (loaded) => {
            loaded.colorSpace = THREE.SRGBColorSpace;
            store.cache.set(slice, loaded);
            store.touchLru(slice);
            store.evict();
            store.pending.delete(slice);
            resolve(loaded);
          },
          undefined,
          () => {
            store.pending.delete(slice);
            reject(new Error(`Failed loading slice ${slice}`));
          },
        );
      });
      store.pending.set(slice, promise);
      return promise;
    },
    [buildSliceUrl],
  );

  useEffect(() => {
    if (!studyId || maxSlices === 0) {
      setTexture(null);
      setLoading(false);
      return;
    }
    const requestId = ++latestRequestRef.current;
    const store = storeRef.current;
    const cached = store.cache.get(currentSlice);
    if (cached) {
      store.touchLru(currentSlice);
      setTexture(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    loadSliceTexture(currentSlice)
      .then((loaded) => {
        if (latestRequestRef.current !== requestId) return;
        setTexture(loaded);
      })
      .catch(() => {
        if (latestRequestRef.current !== requestId) return;
        setTexture(null);
      })
      .finally(() => {
        if (latestRequestRef.current === requestId) setLoading(false);
      });

    [currentSlice - 1, currentSlice + 1]
      .filter((s) => s >= 0 && s < maxSlices)
      .forEach((s) => void loadSliceTexture(s).catch(() => undefined));
  }, [studyId, maxSlices, currentSlice, loadSliceTexture]);

  useEffect(() => () => storeRef.current.disposeAll(), []);

  return { texture, loading };
}
