import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";

export function XRControls() {
  const { gl } = useThree();
  const vrButtonRef = useRef<HTMLElement | null>(null);
  const arButtonRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    gl.xr.enabled = true;
    if (typeof document === "undefined") return;
    if (vrButtonRef.current || arButtonRef.current) return;

    const container = document.createElement("div");
    container.className = "pointer-events-none fixed inset-x-0 bottom-0 z-50 h-16";
    document.body.appendChild(container);
    containerRef.current = container;

    const vrBtn = VRButton.createButton(gl);
    vrBtn.style.position = "absolute";
    vrBtn.style.inset = "auto 0 0 auto";
    container.appendChild(vrBtn);
    vrButtonRef.current = vrBtn;

    const arBtn = ARButton.createButton(gl, {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "local-floor"],
      domOverlay: { root: container },
    });
    arBtn.style.position = "absolute";
    arBtn.style.inset = "auto 7.5rem 0 auto";
    arButtonRef.current = arBtn;
    container.appendChild(arBtn);

    return () => {
      if (vrButtonRef.current?.parentElement) {
        vrButtonRef.current.parentElement.removeChild(vrButtonRef.current);
      }
      if (arButtonRef.current?.parentElement) {
        arButtonRef.current.parentElement.removeChild(arButtonRef.current);
      }
      vrButtonRef.current = null;
      arButtonRef.current = null;
      if (containerRef.current?.parentElement) {
        containerRef.current.parentElement.removeChild(containerRef.current);
      }
      containerRef.current = null;
    };
  }, [gl]);

  return null;
}
