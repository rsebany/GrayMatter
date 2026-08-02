import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getStudySliceUrl } from "@/api/clients";

const HOSPITAL_BASE = "/xr/backgrounds/hospital/";
const HOSPITAL_GLTF = `${HOSPITAL_BASE}scene.gltf`;

export async function hospitalAssetsAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${HOSPITAL_BASE}scene.bin`, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export function preloadHospitalEnvironment(): Promise<void> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setPath(HOSPITAL_BASE);
    loader.load(
      "scene.gltf",
      () => resolve(),
      undefined,
      (err) => reject(err),
    );
  });
}

export function preloadDicomSliceTexture(studyId: string, slice: number): Promise<void> {
  const url = getStudySliceUrl(studyId, slice, {
    windowCenter: -600,
    windowWidth: 1500,
    orientation: "axial",
    includeOverlay: true,
  });
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (texture) => {
        texture.dispose();
        resolve();
      },
      undefined,
      () => reject(new Error(`Failed preload slice ${slice}`)),
    );
  });
}

export async function preloadMeshResource(meshUrl: string): Promise<void> {
  if (!meshUrl.trim()) return;
  try {
    const response = await fetch(meshUrl, { method: "HEAD" });
    if (!response.ok) throw new Error(`Mesh HEAD ${response.status}`);
  } catch {
    // Best-effort; mesh may still load via GLTF loader without HEAD support.
    await fetch(meshUrl).catch(() => undefined);
  }
}

export type PreloadXrSessionOptions = {
  studyId: string | null;
  meshUrl: string;
  dicomSlice: number;
  skipHeavyAssets?: boolean;
};

/** Warm critical assets before entering immersive XR. */
export async function preloadXrSessionAssets(options: PreloadXrSessionOptions): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (!options.skipHeavyAssets && (await hospitalAssetsAvailable())) {
    tasks.push(
      preloadHospitalEnvironment().catch(() => undefined),
    );
  }

  if (options.meshUrl.trim()) {
    tasks.push(preloadMeshResource(options.meshUrl).catch(() => undefined));
  }

  if (!options.skipHeavyAssets && options.studyId) {
    tasks.push(
      preloadDicomSliceTexture(options.studyId, options.dicomSlice).catch(() => undefined),
    );
  }

  await Promise.all(tasks);
}

export { HOSPITAL_GLTF };
