"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { imagingContextQuery, imagingContextFromSearchParams } from "@/lib/imaging";

/** Shown on imaging viewer sub-pages: single link back to DICOM upload with the same case context. */
export function ImagingBackToUploadLink() {
  const searchParams = useSearchParams();
  const { patientId, studyId } = imagingContextFromSearchParams(searchParams);
  const ctx = imagingContextQuery({ patientId, studyId });

  return (
    <div className="mb-4">
      <Link
        href={`/upload-dicom${ctx}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Back to DICOM upload
        {patientId && (
          <span className="font-normal text-muted-foreground/70"></span>
        )}
      </Link>
    </div>
  );
}
