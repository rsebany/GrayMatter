"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";

import { getStudySliceUrl } from "@/api/clients";

type SeriesFilmstripProps = {
  studyId: string;
  depth: number;
  selectedSlice: number;
  windowCenter: number;
  windowWidth: number;
  brightness: number;
  contrast: number;
  onSelect: (slice: number) => void;
};

export function SeriesFilmstrip({
  studyId,
  depth,
  selectedSlice,
  windowCenter,
  windowWidth,
  brightness,
  contrast,
  onSelect,
}: SeriesFilmstripProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedSlice]);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2">
      <h3 className="mb-2 text-[10px] font-medium text-[var(--text-secondary)]">Series</h3>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: depth }, (_, slice) => {
          const selected = slice === selectedSlice;
          return (
            <button
              key={slice}
              ref={selected ? selectedRef : undefined}
              type="button"
              aria-label={`View slice ${slice + 1}`}
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(slice)}
              className="group shrink-0"
            >
              <span
                className={`relative block h-[100px] w-[72px] overflow-hidden rounded-md border-2 bg-black ${
                  selected
                    ? "border-[var(--registry-primary)]"
                    : "border-transparent group-hover:border-[var(--border)]"
                }`}
              >
                <img
                  src={getStudySliceUrl(studyId, slice, {
                    windowCenter,
                    windowWidth,
                    orientation: "axial",
                    includeOverlay: true,
                    overlayOpacity: 0.55,
                  })}
                  loading="lazy"
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ filter: `brightness(${brightness}) contrast(${contrast})` }}
                />
                {selected ? (
                  <span className="absolute inset-0 bg-[var(--registry-primary)]/20" aria-hidden="true" />
                ) : null}
              </span>
              <span
                className={`mt-1 block text-center text-[10px] ${
                  selected ? "text-[var(--registry-primary)]" : "text-[var(--text-muted)]"
                }`}
              >
                {slice + 1}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
