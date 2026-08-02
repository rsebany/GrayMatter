"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { MeshVisualPreset } from "../viewers/three-viewer.types";
import { buildBrainMeshMaterial } from "../viewers/mesh/brain-pbr";

/**
 * Complete human-brain-shaped envelope for the WebXR lab.
 * The backend exports the tissue around the hippocampus as a partial region
 * (bbox shell or eroded-brain mask). This component builds a stylized full
 * human brain — egg-shaped cerebrum with a longitudinal fissure, flattened
 * base, cerebellum and brainstem, plus subtle gyri — so the reconstruction
 * reads as a whole brain that can be zoomed into to inspect the hippocampus.
 */

type BrainEnvelopeProps = {
  /** Scene bounds the envelope must contain (local units). */
  size: [number, number, number];
  /** Center of the envelope in the scene's local units. */
  center: [number, number, number];
  visualPreset: MeshVisualPreset;
  visible: boolean;
};

const CONTAIN_MARGIN = 1.06;
const DETAIL = 5;

/** Cerebrum semi-axes (normalized): X = left–right, Y = cranio-caudal, Z = anterior–posterior. */
const AXES = { x: 1.0, y: 0.78, z: 1.16 } as const;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash3(x: number, y: number, z: number): number {
  let h = x * 374761393 + y * 668265263 + z * 1442695041;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0xffffff) / 0xffffff;
}

function valueNoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = n000 + (n100 - n000) * ux;
  const x10 = n010 + (n110 - n010) * ux;
  const x01 = n001 + (n101 - n001) * ux;
  const x11 = n011 + (n111 - n011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}

/** Build a single closed surface point along a unit direction. */
function brainSurfacePoint(x: number, y: number, z: number): THREE.Vector3 {
  const { x: a, y: b, z: c } = AXES;

  // Egg-shaped cerebrum: longest front-to-back, narrower occiput.
  const ellipsoid = 1 / Math.sqrt((x * x) / (a * a) + (y * y) / (b * b) + (z * z) / (c * c));
  const egg = ellipsoid * (1 + 0.13 * z);

  // Flatter inferior surface.
  const base = egg * (1 - 0.16 * Math.max(0, -y));

  // Cerebellum: rounded knob at the posterior-inferior pole.
  const cerebellum = Math.exp(
    -((x / 0.4) ** 2) - ((z + 0.66) / 0.34) ** 2 - ((y + 0.4) / 0.36) ** 2,
  );
  // Brainstem: tapering bulge at the base, slightly posterior of center.
  const stem = Math.exp(
    -((x / 0.18) ** 2) - ((z + 0.06) / 0.2) ** 2 - ((y + 0.88) / 0.28) ** 2,
  );
  const radius = base * (1 + 0.38 * cerebellum + 0.34 * stem);

  const p = new THREE.Vector3(x * radius, y * radius, z * radius);

  // Longitudinal fissure: deep groove along the superior midline.
  const pinch = Math.exp(-((p.x / 0.11) ** 2));
  const upper = smoothstep(0.1, 0.5, p.y / b);
  p.y -= 0.26 * pinch * upper;

  // Subtle gyri wrinkles (low-frequency value noise).
  const n1 = valueNoise3(x * 2.2, y * 4.4, z * 3.0);
  const n2 = valueNoise3(x * 4.6, y * 9.0, z * 6.2);
  const gyri = (n1 - 0.5) * 0.055 + (n2 - 0.5) * 0.02;
  p.x += x * gyri;
  p.y += y * gyri;
  p.z += z * gyri;

  return p;
}

function buildBrainGeometry(): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(1, DETAIL);
  const index = source.index;
  const srcPos = source.getAttribute("position");
  const count = srcPos.count;

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = srcPos.getX(i);
    const y = srcPos.getY(i);
    const z = srcPos.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const p = brainSurfacePoint(x / len, y / len, z / len);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }
  source.dispose();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

export function BrainEnvelope({ size, center, visualPreset, visible }: BrainEnvelopeProps) {
  const material = useMemo(() => {
    const mat = buildBrainMeshMaterial(visualPreset, "brain_shell");
    mat.side = THREE.DoubleSide;
    return mat;
  }, [visualPreset]);

  const geometry = useMemo(() => {
    const geo = buildBrainGeometry();
    const box = new THREE.Box3().setFromBufferAttribute(
      geo.getAttribute("position") as THREE.BufferAttribute,
    );
    const brainSize = box.getSize(new THREE.Vector3());
    const [rawX, rawY, rawZ] = size;
    const targetX = Math.max(0.001, rawX * CONTAIN_MARGIN);
    const targetY = Math.max(0.001, rawY * CONTAIN_MARGIN);
    const targetZ = Math.max(0.001, rawZ * CONTAIN_MARGIN);

    const maxBrain = Math.max(brainSize.x, brainSize.y, brainSize.z, 1e-6);
    const maxTarget = Math.max(targetX, targetY, targetZ, 1e-6);
    // Keep human-brain proportions by default; only stretch an axis when the
    // real tissue box would otherwise stick out of the envelope.
    const proportional = maxTarget / maxBrain;
    const sx = Math.max(proportional, targetX / brainSize.x);
    const sy = Math.max(proportional, targetY / brainSize.y);
    const sz = Math.max(proportional, targetZ / brainSize.z);
    geo.scale(sx, sy, sz);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }, [size]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <group position={center} visible={visible} renderOrder={1}>
      <mesh geometry={geometry} material={material} renderOrder={1} />
    </group>
  );
}
