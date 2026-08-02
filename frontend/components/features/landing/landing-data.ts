export const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Data Ingestion",
    label: "Upload T1 hippocampus MRI as NIfTI (.nii / .nii.gz).",
  },
  {
    step: "02",
    title: "AI Segmentation",
    label: "3D Residual U-Net inference for hippocampus quantification.",
  },
  {
    step: "03",
    title: "Spatial Analysis",
    label: "Interactive WebXR-based radiological review.",
  },
  {
    step: "04",
    title: "Clinical Reporting",
    label: "Structured volume metrics for longitudinal tracking.",
  },
] as const;

export const RESEARCH_PILLARS = [
  {
    title: "Clinical Precision",
    hint: "Validated hippocampus segmentation (0.829 val Dice baseline).",
  },
  {
    title: "Explainability",
    hint: "Interactive 3D visualization for human oversight.",
  },
  {
    title: "Workflow Integration",
    hint: "Streamlined MRI review with 2D, 3D, and WebXR viewers.",
  },
] as const;
