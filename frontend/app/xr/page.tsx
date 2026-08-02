/**
 * XR hub — choose VR headset or AR / passthrough (preserves query string).
 */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function XrHubPage() {
  const searchParams = useSearchParams();
  const q = searchParams.toString();
  const suffix = q ? `?${q}` : "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-6 py-12">
      <h1 className="text-lg font-semibold text-white">
        How do you want to view?
      </h1>

      <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
        <Link
          href={`/xr/vr${suffix}`}
          className="flex flex-1 items-center justify-center rounded-xl border border-cyan-500/50 bg-cyan-950/50 py-4 text-center font-semibold text-cyan-100 transition hover:bg-cyan-900/60"
        >
          VR headset
        </Link>
        <Link
          href={`/xr/ar${suffix}`}
          className="flex flex-1 items-center justify-center rounded-xl border border-violet-500/50 bg-violet-950/50 py-4 text-center font-semibold text-violet-100 transition hover:bg-violet-900/60"
        >
          AR / passthrough
        </Link>
      </div>
    </div>
  );
}
