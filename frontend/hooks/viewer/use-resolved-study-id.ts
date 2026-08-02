"use client";

import { useEffect, useState } from "react";

import { studyService } from "@/services/study";

type ResolveStudyIdArgs = {
  studyIdParam: string | null;
  patientId: string | null;
};

export function useResolvedStudyId({
  studyIdParam,
  patientId,
}: ResolveStudyIdArgs): string | null {
  const [studyIdFromPatient, setStudyIdFromPatient] = useState<string | null>(null);

  useEffect(() => {
    if (studyIdParam || !patientId) return;

    let cancelled = false;
    studyService
      .getList()
      .then((list) => {
        if (cancelled) return;
        const forPatient = list.filter((s) => s.patient_id === patientId);
        if (forPatient.length === 0) {
          setStudyIdFromPatient(null);
          return;
        }
        forPatient.sort((a, b) => {
          const da = a.acquisition_date ? Date.parse(a.acquisition_date) : 0;
          const db = b.acquisition_date ? Date.parse(b.acquisition_date) : 0;
          return db - da;
        });
        setStudyIdFromPatient(forPatient[0].study_id);
      })
      .catch(() => {
        if (!cancelled) setStudyIdFromPatient(null);
      });
    return () => {
      cancelled = true;
    };
  }, [studyIdParam, patientId]);

  if (studyIdParam) return studyIdParam;
  if (!patientId) return null;
  return studyIdFromPatient;
}
