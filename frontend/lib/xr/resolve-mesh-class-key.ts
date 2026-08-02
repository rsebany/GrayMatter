import * as THREE from "three";

import type { MeshClassKey } from "@/lib/xr/mesh-class-key";

const CLASS_KEYS: MeshClassKey[] = ["left", "right", "brain_shell"];

/** Export palette RGB (mesh_export.py) for vertex-color fallback. */
const PALETTE_RGB: Record<MeshClassKey, [number, number, number]> = {
  left: [16, 185, 129],
  right: [99, 102, 241],
  brain_shell: [148, 163, 184],
};

/** Legacy GLB node names → current class keys. */
const NAME_ALIASES: Record<string, MeshClassKey> = {
  ggo: "left",
  reticulation: "right",
  left_hippocampus: "left",
  left_hippo: "left",
  right_hippocampus: "right",
  right_hippo: "right",
  lung_shell: "brain_shell",
  brain: "brain_shell",
};

function nameToClassKey(name: string): MeshClassKey | null {
  const key = name.toLowerCase().trim();
  if (key in NAME_ALIASES) return NAME_ALIASES[key];
  return CLASS_KEYS.find((k) => key === k || key.includes(k)) ?? null;
}

function classFromMaterialName(obj: THREE.Object3D): MeshClassKey | null {
  if (!(obj instanceof THREE.Mesh)) return null;
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  for (const mat of mats) {
    const maybeName = (mat as THREE.Material | undefined)?.name;
    if (typeof maybeName === "string" && maybeName.trim().length > 0) {
      const fromName = nameToClassKey(maybeName);
      if (fromName) return fromName;
    }
  }
  return null;
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

/** Infer class from dominant vertex color when GLB node names are missing. */
function classFromVertexColors(mesh: THREE.Mesh): MeshClassKey | null {
  const attr = mesh.geometry?.getAttribute("color");
  if (!attr || attr.count === 0) return null;

  const step = Math.max(1, Math.floor(attr.count / 64));
  const sums: Record<MeshClassKey, number> = {
    left: 0,
    right: 0,
    brain_shell: 0,
  };

  for (let i = 0; i < attr.count; i += step) {
    const r = Math.round(attr.getX(i) * 255);
    const g = Math.round(attr.getY(i) * 255);
    const b = Math.round(attr.getZ(i) * 255);
    const sample: [number, number, number] = [r, g, b];

    let bestKey: MeshClassKey = "brain_shell";
    let bestDist = Infinity;
    for (const key of CLASS_KEYS) {
      const dist = colorDistance(sample, PALETTE_RGB[key]);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
      }
    }
    if (bestDist < 80) {
      sums[bestKey] += 1;
    }
  }

  const entries = (Object.entries(sums) as [MeshClassKey, number][]).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/** Match GLB node / geometry names from backend mesh export. */
export function resolveMeshClassKey(obj: THREE.Object3D): MeshClassKey | null {
  const tagged = (obj as { userData?: { meshClass?: unknown } }).userData?.meshClass;
  if (typeof tagged === "string") {
    const fromTagged = nameToClassKey(tagged);
    if (fromTagged) return fromTagged;
  }
  let current: THREE.Object3D | null = obj;
  while (current) {
    const fromName = nameToClassKey(current.name);
    if (fromName) return fromName;
    if (current instanceof THREE.Mesh) {
      const geomName = current.geometry?.name;
      if (typeof geomName === "string" && geomName.trim().length > 0) {
        const fromGeom = nameToClassKey(geomName);
        if (fromGeom) return fromGeom;
      }
      const fromMat = classFromMaterialName(current);
      if (fromMat) return fromMat;
    }
    const ud = current.userData?.name;
    if (typeof ud === "string") {
      const fromUd = nameToClassKey(ud);
      if (fromUd) return fromUd;
    }
    current = current.parent;
  }

  if (obj instanceof THREE.Mesh) {
    return classFromVertexColors(obj);
  }
  return null;
}

/** Tag every mesh so materials survive GLTF nesting quirks. */
export function tagMeshClassKeys(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const key = resolveMeshClassKey(child);
    if (key) {
      child.userData.meshClass = key;
    }
  });
}
