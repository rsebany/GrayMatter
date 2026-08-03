import time

from inference.mesh import mask_to_glb
from inference.model_manager import ModelManager, model_manager
from inference.postprocess import clean_mask, compute_volume_mm3_from_affine
from inference.preprocess import preprocess_volume, save_mask_nifti, storage_client


class InferencePipeline:
    def __init__(self, manager: ModelManager | None = None) -> None:
        self.manager = manager or model_manager

    def run(self, prediction_id: str, mri_s3_path: str, weights_s3_path: str | None = None) -> dict:
        started = time.perf_counter()
        predictor = self.manager.get_predictor(weights_s3_path)
        volume_bytes = storage_client.download(mri_s3_path)
        image, affine = preprocess_volume(volume_bytes)
        raw_mask = predictor.predict(image)
        mask = clean_mask(raw_mask)
        mask_bytes = save_mask_nifti(mask, affine)
        glb_bytes = mask_to_glb(mask)

        mask_key = f"anatomical-masks/{prediction_id}_hippocampus_mask.nii.gz"
        mesh_key = f"webxr-meshes/{prediction_id}_geometry_optimized.glb"
        storage_client.upload(mask_key, mask_bytes, "application/gzip")
        storage_client.upload(mesh_key, glb_bytes, "model/gltf-binary")

        elapsed = time.perf_counter() - started
        return {
            "mask_s3_path": mask_key,
            "mesh_s3_path": mesh_key,
            "volume_mm3": compute_volume_mm3_from_affine(mask, affine),
            "execution_time": round(elapsed, 3),
        }
