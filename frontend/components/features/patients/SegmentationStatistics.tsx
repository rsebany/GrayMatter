"use client";

import { useQuery } from "@tanstack/react-query";

import { getStudyMask } from "@/api/clients";
import type { SegmentationResult } from "@/api/domain";
import { useStudyMetrics } from "@/hooks/studies";
import { calculateHippocampusSubregions } from "@/lib/metrics/hippocampus-subregions";

type SegmentationStatisticsProps = {
  studyId: string;
  segmentation?: SegmentationResult | null;
};

function formatVolume(value: number | null | undefined): string {
  return typeof value === "number" ? value.toFixed(2) : "Not available";
}

function scaledVolume(
  total: number | null | undefined,
  fraction: number | undefined,
): number | undefined {
  return typeof total === "number" && typeof fraction === "number"
    ? total * fraction
    : undefined;
}

export function SegmentationStatistics({
  studyId,
  segmentation,
}: SegmentationStatisticsProps) {
  const { data: metrics, isLoading: metricsLoading } = useStudyMetrics(studyId);
  const { data: distribution, isLoading: distributionLoading } = useQuery({
    queryKey: ["studies", "subregion-volumes", studyId],
    queryFn: async () => {
      const { data, shape } = await getStudyMask(studyId);
      return calculateHippocampusSubregions(data, shape);
    },
  });

  const left = metrics?.left_hippocampus_ml ?? segmentation?.left_hippocampus_ml;
  const right = metrics?.right_hippocampus_ml ?? segmentation?.right_hippocampus_ml;
  const combined =
    metrics?.hippocampus_volume_ml ??
    segmentation?.hippocampus_volume_ml ??
    (typeof left === "number" && typeof right === "number" ? left + right : undefined);
  const leftAnterior = scaledVolume(left, distribution?.left.anteriorFraction);
  const leftPosterior = scaledVolume(left, distribution?.left.posteriorFraction);
  const rightAnterior = scaledVolume(right, distribution?.right.anteriorFraction);
  const rightPosterior = scaledVolume(right, distribution?.right.posteriorFraction);
  const isLoading = metricsLoading || distributionLoading;

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
      <div className="border-b border-[var(--border)] px-3 py-3">
        <h2 className="text-xs font-medium text-[var(--text-primary)]">
          Segmentation Statistics
        </h2>
      </div>
      {isLoading ? (
        <p className="p-4 text-xs text-[var(--text-muted)]">Calculating statistics...</p>
      ) : (
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[9px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Region
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Volume (ml)
              </th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-secondary)]">
            <tr className="bg-[var(--surface-1)]">
              <th scope="row" className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">
                Left Hippocampus
              </th>
              <td className="px-3 py-2 text-right">{formatVolume(left)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 pl-6">Anterior subregion</td>
              <td className="px-3 py-2 text-right">{formatVolume(leftAnterior)}</td>
            </tr>
            <tr className="bg-[var(--surface-1)]">
              <td className="px-3 py-2 pl-6">Posterior subregion</td>
              <td className="px-3 py-2 text-right">{formatVolume(leftPosterior)}</td>
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2 text-left font-medium text-[var(--text-primary)]">
                Right Hippocampus
              </th>
              <td className="px-3 py-2 text-right">{formatVolume(right)}</td>
            </tr>
            <tr className="bg-[var(--surface-1)]">
              <td className="px-3 py-2 pl-6">Anterior subregion</td>
              <td className="px-3 py-2 text-right">{formatVolume(rightAnterior)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 pl-6">Posterior subregion</td>
              <td className="px-3 py-2 text-right">{formatVolume(rightPosterior)}</td>
            </tr>
            <tr className="border-t border-[var(--border)] bg-[var(--surface-1)] font-medium text-[var(--text-primary)]">
              <th scope="row" className="px-3 py-2.5 text-left font-medium">
                Combined (Left + Right)
              </th>
              <td className="px-3 py-2.5 text-right">{formatVolume(combined)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
