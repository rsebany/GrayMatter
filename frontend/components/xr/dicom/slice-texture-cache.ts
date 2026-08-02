import * as THREE from "three";
import { TEXTURE_CACHE_LIMIT } from "./constants";

export function createSliceTextureCache() {
  const cache = new Map<number, THREE.Texture>();
  const pending = new Map<number, Promise<THREE.Texture>>();

  const touchLru = (slice: number) => {
    const cached = cache.get(slice);
    if (!cached) return;
    cache.delete(slice);
    cache.set(slice, cached);
  };

  const evict = () => {
    while (cache.size > TEXTURE_CACHE_LIMIT) {
      const firstKey = cache.keys().next().value;
      if (typeof firstKey !== "number") break;
      cache.get(firstKey)?.dispose();
      cache.delete(firstKey);
    }
  };

  const disposeAll = () => {
    pending.clear();
    cache.forEach((tex) => tex.dispose());
    cache.clear();
  };

  return { cache, pending, touchLru, evict, disposeAll };
}
