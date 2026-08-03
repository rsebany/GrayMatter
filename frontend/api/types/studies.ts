/**
 * Study types — list items, segmentation, upload, expert compare, DICOM, sync events.
 */
import type { Patient } from "./patients";

// ---------------------------------------------------------------------------
// Shared segmentation shapes
// ---------------------------------------------------------------------------

/** Upper / Middle / Lower — % of ILD voxels in each craniocaudal third. */
export type ZonalDistribution = Record<string, number>;

/** @deprecated Renamed to ZonalDistribution. Kept as an alias to avoid breaking imports. */
export type LobarDistribution = ZonalDistribution;

export interface XRViewConfig {
  id: string;
  mesh_url: string;
  stl_url?: string;
  clipping_enabled: boolean;
}

// ---------------------------------------------------------------------------
// Segmentation results
// ---------------------------------------------------------------------------

export interface SegmentationResult {
  id: string;
  total_ild_volume_ml: number;
  /** Clear alias: total hippocampus volume (cm³ ≡ ml). */
  hippocampus_volume_ml?: number | null;
  left_hippocampus_ml?: number | null;
  right_hippocampus_ml?: number | null;
  /** Foreground / intracranial reference volume (legacy field name). */
  lung_volume_ml?: number | null;
  /** Hippocampus burden fraction (legacy field name `ild_burden`). */
  ild_burden?: number | null;
  /** Left hippocampus volume (legacy API field `ggo_volume_ml`). */
  ggo_volume_ml?: number | null;
  /** Right hippocampus volume (legacy API field `reticulation_volume_ml`). */
  reticulation_volume_ml?: number | null;
  /** Left hippocampus burden (legacy API field `ggo_burden`). */
  ggo_burden?: number | null;
  /** Right hippocampus burden (legacy API field `reticulation_burden`). */
  reticulation_burden?: number | null;
  zonal_distribution: ZonalDistribution;
  mesh_url: string;
  stl_url?: string;
  xr_view?: XRViewConfig | null;
  visualization_mode: "2d" | "3d" | "xr" | "mixed";
  dice_score?: number | null;
}

/** Segmentation with guaranteed XR mesh field for viewers / upload pipeline. */
export type SegmentationResultDTO = SegmentationResult & {
  xr_view: XRViewConfig;
};

// ---------------------------------------------------------------------------
// Study entities
// ---------------------------------------------------------------------------

export interface Study {
  id: string;
  description?: string | null;
  created_at: string;
  modality: string;
  segmentation?: SegmentationResult | null;
}

export interface StudyListItem {
  study_id: string;
  patient_id: string;
  patient_name: string;
  modality: string;
  ild_fraction: number;
  volume_total_mm3: number;
  status: "Completed" | "Processing" | "Pending";
  acquisition_date?: string | null;
  /** Upper / Middle / Lower — % of ILD burden per craniocaudal zone. */
  zonal_distribution?: ZonalDistribution;
  lung_volume_ml?: number | null;
  ggo_volume_ml?: number | null;
  reticulation_volume_ml?: number | null;
  ggo_burden?: number | null;
  reticulation_burden?: number | null;
}

/** Metrics from `GET /studies/{id}/metrics` and `POST .../ai-analysis`. */
export interface StudyMetrics {
  study_id: string;
  volume_total_mm3: number;
  /** Hippocampus burden fraction (legacy API field `ild_fraction`). */
  ild_fraction: number;
  ild_burden?: number | null;
  hippocampus_volume_ml?: number | null;
  left_hippocampus_ml?: number | null;
  right_hippocampus_ml?: number | null;
  /** Legacy name for total hippocampus volume (cm³). */
  total_ild_volume_ml?: number | null;
  zonal_distribution: Record<string, number>;
  lung_volume_ml?: number | null;
  ggo_volume_ml?: number | null;
  reticulation_volume_ml?: number | null;
  ggo_burden?: number | null;
  reticulation_burden?: number | null;
  architecture_id?: string | null;
  architecture_label?: string | null;
}

/** Option from `GET /studies/architectures`. */
export interface ArchitectureOption {
  id: string;
  label: string;
  builder: string;
  best_val_dice?: number | null;
  is_default: boolean;
  available: boolean;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadStudyResponse {
  study_id: string;
  patient: Patient;
}

/** Payload for `POST /studies/upload` `patient` form field (JSON). */
export interface UploadStudyPatientPayload {
  id?: string;
  name: string;
  dob?: string;
  sex?: string;
}

// ---------------------------------------------------------------------------
// Expert mask compare
// ---------------------------------------------------------------------------

/** Response from POST /studies/upload/expert-mask-compare */
export interface ExpertMaskCompareResponse {
  study_id: string;
  expert_shape: [number, number, number];
  prediction_shape: [number, number, number];
  dice: Record<string, number>;
  expert_label_max_seen: number;
  /** Kept false; experts are remapped, not clipped to class 3. */
  expert_labels_were_clipped: boolean;
  expert_remap_mode: string;
  expert_remap_note?: string | null;
  expert_labels_were_remapped: boolean;
  /** Voxel counts for labels 0–3 on expert (after remap to model classes). */
  voxel_count_expert: Record<string, number>;
  voxel_count_prediction: Record<string, number>;
  /** If true, Dice=1 for that class only means both masks have zero voxels of that class. */
  dice_vacuous_both_empty: Record<string, boolean>;
  foreground_overlap_voxels: number;
  expert_foreground_voxels: number;
  prediction_foreground_voxels: number;
  voxel_agreement_fraction: number;
  interpretation_hint?: string | null;
  expert_stack_mode?: string | null;
  expert_inplane_correction?: string | null;
  expert_slices_matched?: number | null;
}

// ---------------------------------------------------------------------------
// DICOM volume & realtime sync
// ---------------------------------------------------------------------------

/** Native DICOM grid from `GET /studies/{id}/dicom-shape` (Z,Y,X indexing). */
export type DicomVolumeShape = {
  depth: number;
  height: number;
  width: number;
  spacing_z_mm: number;
  spacing_y_mm: number;
  spacing_x_mm: number;
};

/** SSE payloads from `GET /studies/{id}/events`. */
export type StudySyncEvent =
  | {
      event: "mesh.updated";
      study_id: string;
      revision_id: number;
      mesh_url?: string;
      metrics?: Record<string, number>;
      zonal_distribution?: Record<string, number>;
      ts?: string;
    }
  | {
      event: "segmentation.status";
      study_id: string;
      current_revision_id: number;
      latest?: {
        revision_id: number;
        mesh_url?: string | null;
      } | null;
    };
