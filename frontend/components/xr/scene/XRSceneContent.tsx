"use client";

import { Suspense, useCallback, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import { XRControllers } from "@/components/features/viewer/xr/XRControllers";
import { XRInteractionLayer } from "@/components/features/viewer/xr/core/XRInteractionLayer";
import { XR_CLINICAL_ZONE } from "@/lib/xr/layout-constants";
import { XrEnvironmentLayer } from "../environment";
import { ClinicalZoneContent } from "./ClinicalZoneContent";
import { ImmersiveClearColor } from "./ImmersiveClearColor";
import { useArTouchGestures } from "./hooks/use-ar-touch-gestures";
import { useCameraFocus } from "./hooks/use-camera-focus";
import { useMeshSceneState } from "./hooks/use-mesh-scene-state";
import { useUserLesions } from "./hooks/use-user-lesions";
import { useXrPanels } from "./hooks/use-xr-panels";
import { ArPlacementHint, ScenePresentationHint } from "./ScenePresentationHint";
import type { XRSceneContentProps } from "./types";
import { XrPanelsLayer } from "./XrPanelsLayer";
import { XrSceneLoadingFallback } from "./XrSceneLoadingFallback";

export function XRSceneContent(props: XRSceneContentProps) {
  const {
    meshUrl, useMeshPlaceholder, solidBrainEnabled = false, onToggleSolidBrain, onResetView, studyId, dicomSliceCount,
    currentDicomSlice, onDicomSliceChange, focusStackNonce, focusMeshNonce, focusBalancedNonce,
    meshScale, classVisibility, onZoomIn, onZoomOut, onPresetAll, onPresetLesions, onPresetShell,
    onToggleMeshClass, sceneVariant = "vr", arQuality = "performance", arPerformanceMode = false,
    onArQualityChange, isDicomPlaying, onToggleDicomPlay, onPauseDicomPlay, vrSpawnNonce = 0,
  } = props;

  const controlsRef = useRef<unknown>(null);
  const meshGroupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const session = useXR((s) => s.session);
  const isPresenting = Boolean(session);
  const isArImmersive = isPresenting && sceneVariant === "ar";
  const useHtmlControls = !isPresenting;
  const showImmersive3DControls = isPresenting;
  const hideHeavyArAssets = sceneVariant === "ar" && arPerformanceMode && isPresenting;

  const meshState = useMeshSceneState({ isPresenting, isArImmersive, sceneVariant, vrSpawnNonce });
  const { panels, createPanelTexture, addPanel, clearPanels } = useXrPanels();
  const lesions = useUserLesions(meshGroupRef);

  useCameraFocus(camera, controlsRef, focusStackNonce, focusMeshNonce, focusBalancedNonce);

  const placeInFront = useCallback(() => {
    meshState.placeArContentInFrontOfUser(camera);
  }, [camera, meshState]);

  const { arPlaced } = useArTouchGestures({
    sceneVariant,
    isPresenting,
    camera,
    gl,
    onZoomIn,
    onZoomOut,
    placeInFront,
    setArAnchor: meshState.setArAnchor,
  });

  const handleReset = () => {
    meshState.resetMeshTransform();
    const ctrl = controlsRef.current as { reset?: () => void } | null;
    ctrl?.reset?.();
    onResetView?.();
  };

  return (
    <>
      <ImmersiveClearColor sceneVariant={sceneVariant} />
      <ambientLight intensity={0.35} />
      <pointLight position={[10, 10, 10]} intensity={0.55} />
      <pointLight position={[-10, 5, -10]} intensity={0.3} />

      {!hideHeavyArAssets && <XrEnvironmentLayer />}
      <XRInteractionLayer />

      <XRControllers onResetView={handleReset}>
        <Suspense fallback={<XrSceneLoadingFallback />}>
          <group name="clinical-zone" position={meshState.clinicalZonePosition}>
            <ClinicalZoneContent
              meshGroupRef={meshGroupRef}
              meshUrl={meshUrl}
              useMeshPlaceholder={useMeshPlaceholder}
              solidBrainEnabled={solidBrainEnabled}
              meshGroupPosition={meshState.meshGroupPosition}
              meshScale={meshScale}
              meshDisplayRotation={meshState.meshDisplayRotation}
              classVisibility={classVisibility}
              showImmersive3DControls={showImmersive3DControls}
              useHtmlControls={useHtmlControls}
              isPresenting={isPresenting}
              isArImmersive={isArImmersive}
              arQuality={arQuality}
              hideHeavyArAssets={hideHeavyArAssets}
              studyId={studyId}
              dicomSliceCount={dicomSliceCount}
              currentDicomSlice={currentDicomSlice}
              onDicomSliceChange={onDicomSliceChange}
              isDicomPlaying={isDicomPlaying}
              onToggleDicomPlay={onToggleDicomPlay}
              onPauseDicomPlay={onPauseDicomPlay}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onPresetAll={onPresetAll}
              onPresetLesions={onPresetLesions}
              onPresetShell={onPresetShell}
              onToggleMeshClass={onToggleMeshClass}
              onArQualityChange={onArQualityChange}
              onToggleSolidBrain={onToggleSolidBrain ?? (() => {})}
              onCenterAr={placeInFront}
              rotateMeshY={meshState.rotateMeshY}
              resetMeshRotation={meshState.resetMeshRotation}
              flipMesh={meshState.flipMesh}
              onAddPanel={addPanel}
              onClearPanels={clearPanels}
              placingLesion={lesions.placingLesion}
              setPlacingLesion={lesions.setPlacingLesion}
              userLesions={lesions.userLesions}
              onClearLesions={lesions.clearLesions}
              onSurfacePick={lesions.handleSurfacePick}
            />
          </group>
          {isPresenting ? <XrPanelsLayer panels={panels} createTexture={createPanelTexture} /> : null}
        </Suspense>
      </XRControllers>

      <OrbitControls
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={controlsRef as any}
        target={[...XR_CLINICAL_ZONE.center]}
        makeDefault
        enabled={!isPresenting}
        enableDamping
        dampingFactor={0.08}
        enableRotate
        enablePan={false}
        rotateSpeed={0.65}
        zoomSpeed={0.65}
        maxPolarAngle={Math.PI * 0.95}
      />

      {isPresenting ? <ScenePresentationHint sceneVariant={sceneVariant} /> : null}
      <ArPlacementHint visible={isArImmersive && !arPlaced} position={meshState.clinicalZonePosition} />
    </>
  );
}
