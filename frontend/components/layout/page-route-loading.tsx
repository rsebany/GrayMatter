import { FullscreenLoading } from "@/components/ui/loading";

type PageRouteLoadingProps = {
  /** Shown next to the spinner (e.g. "Loading dashboard…") */
  label?: string;
};

/**
 * Default content for App Router `loading.tsx` route segments.
 */
export function PageRouteLoading({ label = "Loading…" }: PageRouteLoadingProps) {
  return <FullscreenLoading label={label} />;
}
