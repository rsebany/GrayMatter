"use client";

import { Suspense, useEffect, useState } from "react";
import { HospitalBackground } from "@/components/features/viewer/xr/backgrounds/HospitalBackground";
import { DarkFallbackRoom } from "./DarkFallbackRoom";
import { hospitalBinAvailable } from "./hospital-assets";
import { HospitalLoadBoundary } from "./HospitalLoadBoundary";

/** Hospital GLTF when assets exist; dark procedural room only if the GLB is missing. */
export function XrEnvironmentLayer() {
  const [assetsReady, setAssetsReady] = useState<boolean | null>(null);
  const [hospitalFailed, setHospitalFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hospitalBinAvailable().then((ok) => {
      if (!cancelled) setAssetsReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const showHospital = assetsReady === true && !hospitalFailed;

  return (
    <>
      {!showHospital && <DarkFallbackRoom />}
      {assetsReady === true && (
        <HospitalLoadBoundary onFailed={() => setHospitalFailed(true)}>
          <Suspense fallback={null}>
            <HospitalBackground />
          </Suspense>
        </HospitalLoadBoundary>
      )}
    </>
  );
}
