"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { imagingContextQuery, imagingContextFromSearchParams } from "@/lib/imaging";

const linkClass =
  "rounded-md border border-white/15 bg-slate-950/80 px-2 py-1 text-[10px] font-medium text-sky-200 backdrop-blur-sm transition-colors hover:border-sky-400/50 hover:text-white";

type Props = {
  /** Only 2D / 3D viewers — fewer chips in immersive UI. */
  variant?: "full" | "navigationOnly";
};

export function XrPipelineQuickLinks({ variant = "full" }: Props) {
  const searchParams = useSearchParams();
  const { patientId, studyId } = imagingContextFromSearchParams(searchParams);
  const ctx = imagingContextQuery({ patientId, studyId });
  if (!patientId && !studyId) return null;

  return (
    <nav
      aria-label="Open study in viewer"
      className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide"
    >
      <Link href={`/view2d${ctx}`} className={linkClass}>
        2D
      </Link>
      <Link href={`/view3d${ctx}`} className={linkClass}>
        3D
      </Link>
      {variant === "full" && (
        <>
          <Link href={`/upload-dicom${ctx}`} className={linkClass}>
            Upload
          </Link>
          <Link href={`/webxr${ctx}`} className={linkClass}>
            WebXR
          </Link>
        </>
      )}
    </nav>
  );
}
