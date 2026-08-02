"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";
import { getStudyDicomZip } from "@/api/clients";

export type DicomLoadStatus = "idle" | "loading" | "loaded" | "failed";

type UseDicomLoaderResult = {
  files: File[] | null;
  status: DicomLoadStatus;
  error: string | null;
};

/**
 * Loads a DICOM series for a given study ID by calling
 * `GET /studies/{study_id}/dicom-zip` and expanding the ZIP into `File` objects.
 */
export function useDicomLoader(
  studyId: string | null | undefined,
  enabled: boolean = true,
): UseDicomLoaderResult {
  const [files, setFiles] = useState<File[] | null>(null);
  const [status, setStatus] = useState<DicomLoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studyId || !enabled) {
      setFiles(null);
      setStatus("idle");
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setStatus("loading");
        setError(null);

        const blob = await getStudyDicomZip(studyId as string);
        if (cancelled) return;

        const zip = await JSZip.loadAsync(blob);
        const dcmEntries = Object.entries(zip.files).filter(([name]) =>
          name.toLowerCase().endsWith(".dcm") ||
          name.toLowerCase().endsWith(".dicom"),
        );

        if (dcmEntries.length === 0) {
          if (!cancelled) {
            setStatus("failed");
            setError("DICOM archive contains no .dcm/.dicom files.");
          }
          return;
        }

        const loadedFiles: File[] = [];
        for (const [name, entry] of dcmEntries) {
          const buf = await entry.async("arraybuffer");
          loadedFiles.push(
            new File([buf], name.split("/").pop() ?? name, {
              type: "application/dicom",
            }),
          );
        }

        loadedFiles.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        );

        if (!cancelled) {
          setFiles(loadedFiles);
          setStatus("loaded");
        }
      } catch (err: any) {
        if (cancelled) return;

        const rawMessage: string = err?.message ?? "";
        if (
          /DICOM series is not available on the server for this study/i.test(
            rawMessage,
          ) ||
          /Failed to reconstruct DICOM data from volume_path/i.test(rawMessage) ||
          /Imaging volume not found on disk/i.test(rawMessage)
        ) {
          setStatus("idle");
          setError(null);
          return;
        }

        setStatus("failed");
        const message =
          err?.code === "ECONNABORTED" || /timeout/i.test(rawMessage)
            ? "Download timed out. Try again or use a smaller series."
            : rawMessage || "Failed to load DICOM.";
        setError(message);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [studyId, enabled]);

  return { files, status, error };
}
