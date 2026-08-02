import { useMemo } from "react";
import * as THREE from "three";
import { applyBrainPbrToScene } from "@/components/features/viewer/xr/viewers/mesh/brain-pbr";
import type { MeshVisualPreset } from "@/components/features/viewer/xr/viewers/three-viewer.types";
import { applyBrainAnatomicalOrientation } from "@/lib/xr/brain-orientation";
import { resolveMeshClassKey, tagMeshClassKeys } from "@/lib/xr/resolve-mesh-class-key";
import { BrainEnvelope } from "./BrainEnvelope";
import type { BrainMeshClippingProps } from "./brain-mesh.types";

/**
 * Brain proportions (width/height/depth) applied to the lab brain envelope so
 * it keeps a recognizable brain silhouette even when the exported shell is a
 * plain bounding box around the hippocampus.
 */
const BRAIN_PROPORTIONS = { x: 1.0, y: 0.78, z: 1.15 } as const;
const SHELL_MARGIN = 1.04;

export function BrainMeshClipping({
  scene,
  classVisibility,
  visualPreset = "anatomicalBrainSemi",
}: BrainMeshClippingProps & {
  visualPreset?: MeshVisualPreset;
}) {
  const preparedScene = useMemo(() => {
    const clone = scene.clone();
    tagMeshClassKeys(clone);
    applyBrainAnatomicalOrientation(clone);
    applyBrainPbrToScene(clone, visualPreset);

    const bounds = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    const normalizedScale = 1.6 / maxDim;

    let hasShell = false;
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;
      const key = resolveMeshClassKey(child);
      if (key === "brain_shell") {
        hasShell = true;
      }
      if (key && classVisibility) {
        // The exported tissue around the hippocampus is partial; it is replaced
        // by the complete BrainEnvelope below (WebXR lab only).
        child.visible = key === "brain_shell" ? false : classVisibility[key];
      }
      const mats = Array.isArray(child.material)
        ? (child.material as THREE.Material[])
        : [child.material as THREE.Material];
      mats.forEach((m) => {
        m.clippingPlanes = [];
        m.clipIntersection = false;
        if (key === "brain_shell") {
          m.side = THREE.DoubleSide;
        }
      });
    });

    const inflate = hasShell ? SHELL_MARGIN : 1.6;
    // Human-brain height is ~78% of its width. The exported tissue box around
    // the hippocampus is often near-cubic, which would stretch the envelope
    // into a column; cap vertical growth so the silhouette stays brain-like
    // while still containing the tissue top/bottom.
    const proportionalY = maxDim * BRAIN_PROPORTIONS.y * 1.08;
    const envelopeSize: [number, number, number] = [
      Math.max(maxDim * BRAIN_PROPORTIONS.x * 1.08, size.x * inflate),
      Math.min(Math.max(proportionalY, size.y * inflate), proportionalY * 1.12),
      Math.max(maxDim * BRAIN_PROPORTIONS.z * 1.08, size.z * inflate),
    ];

    return { clone, center, normalizedScale, envelopeSize };
  }, [scene, classVisibility, visualPreset]);

  const offset = preparedScene.center
    .clone()
    .multiplyScalar(-preparedScene.normalizedScale);

  return (
    <group scale={preparedScene.normalizedScale} position={offset}>
      <primitive object={preparedScene.clone} />
      <BrainEnvelope
        size={preparedScene.envelopeSize}
        center={[
          preparedScene.center.x,
          preparedScene.center.y,
          preparedScene.center.z,
        ]}
        visualPreset={visualPreset}
        visible={classVisibility?.brain_shell ?? true}
      />
    </group>
  );
}
