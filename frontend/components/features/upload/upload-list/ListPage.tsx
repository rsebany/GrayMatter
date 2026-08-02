"use client";

import React from "react";
import {
  UploadList,
  UploadListPatient,
  UploadListStudy,
  UploadListProps,
} from "@/components/features/upload/upload-list/UploadList";

export type Patient = UploadListPatient;
export type Study = UploadListStudy;
export type UnifiedListProps = UploadListProps;

// Backwards-compatible wrapper keeping the old component name
export function ListPage(props: UnifiedListProps) {
  return <UploadList {...props} />;
}

