import * as THREE from "three";

import { resolveMeshClassKey } from "@/lib/xr/resolve-mesh-class-key";
import type { MeshClassKey, MeshVisualPreset } from "../three-viewer.types";

const LEFT_HIPPO_COLOR = 0x10b981;
const RIGHT_HIPPO_COLOR = 0x6366f1;
const BRAIN_SHELL_SEMI_COLOR = 0xd8cfc4;
const BRAIN_SHELL_SOLID_COLOR = 0xb8c4d4;

export type BrainVisualStyle = "semi" | "solid";

function isBrainSolidPreset(visualPreset: MeshVisualPreset): boolean {
  return visualPreset === "anatomicalBrain";
}

function disposeMeshMaterials(mesh: THREE.Mesh) {
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((m) => m.dispose());
  } else {
    mesh.material?.dispose();
  }
}

export function classKeyOf(mesh: THREE.Mesh): MeshClassKey | null {
  const tagged = mesh.userData?.meshClass;
  if (typeof tagged === "string" && tagged.length > 0) {
    return tagged as MeshClassKey;
  }
  return resolveMeshClassKey(mesh);
}

export function buildBrainMeshMaterial(
  visualPreset: MeshVisualPreset,
  classKey: MeshClassKey | null,
): THREE.MeshPhysicalMaterial {
  const style: BrainVisualStyle = isBrainSolidPreset(visualPreset) ? "solid" : "semi";

  if (classKey === "brain_shell") {
    if (style === "semi") {
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(BRAIN_SHELL_SEMI_COLOR),
        roughness: 0.68,
        metalness: 0.02,
        transmission: 0.12,
        thickness: 0.8,
        clearcoat: 0.06,
        clearcoatRoughness: 0.85,
        envMapIntensity: 0.9,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    }
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(BRAIN_SHELL_SOLID_COLOR),
      roughness: 0.82,
      metalness: 0,
      envMapIntensity: 0.75,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      side: THREE.FrontSide,
    });
  }

  if (classKey === "left") {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(LEFT_HIPPO_COLOR),
      roughness: style === "semi" ? 0.34 : 0.3,
      metalness: 0.06,
      emissive: new THREE.Color(LEFT_HIPPO_COLOR),
      emissiveIntensity: style === "semi" ? 0.28 : 0.12,
      clearcoat: 0.18,
      clearcoatRoughness: 0.45,
      envMapIntensity: 1.15,
      transparent: false,
      depthWrite: true,
    });
  }

  if (classKey === "right") {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(RIGHT_HIPPO_COLOR),
      roughness: style === "semi" ? 0.34 : 0.3,
      metalness: 0.06,
      emissive: new THREE.Color(RIGHT_HIPPO_COLOR),
      emissiveIntensity: style === "semi" ? 0.28 : 0.12,
      clearcoat: 0.18,
      clearcoatRoughness: 0.45,
      envMapIntensity: 1.15,
      transparent: false,
      depthWrite: true,
    });
  }

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(BRAIN_SHELL_SEMI_COLOR),
    roughness: 0.7,
    metalness: 0,
    envMapIntensity: 0.8,
  });
}

export function applyBrainPbrToScene(root: THREE.Object3D, visualPreset: MeshVisualPreset) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    child.geometry.computeVertexNormals();
    const classKey = classKeyOf(child);
    if (classKey) {
      child.userData.meshClass = classKey;
    }
    const mat = buildBrainMeshMaterial(visualPreset, classKey);
    disposeMeshMaterials(child);
    child.material = mat;
    child.userData.meshVisualPreset = visualPreset;
    if (classKey === "brain_shell") {
      child.renderOrder = 1;
    } else if (classKey) {
      child.renderOrder = 5;
    }
  });
}
