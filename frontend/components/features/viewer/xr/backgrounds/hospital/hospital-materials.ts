import * as THREE from "three";
import { MIN_HOSPITAL_GLASS_OPACITY } from "./hospital.constants";

const BRIGHT_SURFACE_DIM = 0.72;
const BRIGHT_CHANNEL_THRESHOLD = 0.9;

/** Darken near-white surfaces (walls, floor, equipment) so the room doesn't glare. */
function dimNearWhiteColor(mat: THREE.Material) {
  const color = (mat as THREE.MeshStandardMaterial).color;
  if (!color || color.r < BRIGHT_CHANNEL_THRESHOLD || color.g < BRIGHT_CHANNEL_THRESHOLD || color.b < BRIGHT_CHANNEL_THRESHOLD) {
    return;
  }
  color.multiplyScalar(BRIGHT_SURFACE_DIM);
}

function dimNearWhiteEmissive(mat: THREE.Material) {
  const emissive = (mat as THREE.MeshStandardMaterial).emissive;
  if (!emissive || emissive.r < BRIGHT_CHANNEL_THRESHOLD || emissive.g < BRIGHT_CHANNEL_THRESHOLD || emissive.b < BRIGHT_CHANNEL_THRESHOLD) {
    return;
  }
  emissive.multiplyScalar(BRIGHT_SURFACE_DIM);
}

function hasUsableTexture(map: THREE.Texture | null | undefined): map is THREE.Texture {
  const image = map?.image as { width?: number; height?: number } | undefined;
  return Boolean(image && image.width && image.height);
}

/** Stabilize GLTF unlit/blend materials for WebXR (Quest, mobile AR) and local clipping. */
export function sanitizeHospitalMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;

    const apply = (mat: THREE.Material) => {
      const m = mat.clone();
      m.clippingPlanes = [];
      m.clipShadows = false;

      dimNearWhiteColor(m);
      dimNearWhiteEmissive(m);

      if (m instanceof THREE.MeshBasicMaterial) {
        if (m.map && !hasUsableTexture(m.map)) {
          m.map = null;
        }
        if (m.alphaMap && !hasUsableTexture(m.alphaMap)) {
          m.alphaMap = null;
        }

        const needsBlend = m.transparent || m.opacity < 1;
        if (needsBlend) {
          m.transparent = true;
          m.depthWrite = false;
          if (m.opacity < MIN_HOSPITAL_GLASS_OPACITY) {
            m.opacity = MIN_HOSPITAL_GLASS_OPACITY;
            m.alphaTest = 0.02;
          }
        }
      }

      m.needsUpdate = true;
      return m;
    };

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(apply);
    } else if (obj.material) {
      obj.material = apply(obj.material);
    }
  });
}
