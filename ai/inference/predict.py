from pathlib import Path

import numpy as np
import torch
from inference.preprocess import get_runtime_config
from models.hybrid_attention_unet import build_model
from preprocessing.transforms import predict_volume_numpy


class ModelWeightsNotFoundError(RuntimeError):
    """Raised when trained weights cannot be loaded."""


class Predictor:
    def __init__(self, checkpoint_path: str, device: str | None = None, require_weights: bool = True) -> None:
        self.config = get_runtime_config()
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = build_model(self.config).to(self.device)
        self.weights_loaded = self._load_checkpoint(checkpoint_path, require_weights=require_weights)
        self.model.eval()

    def _load_checkpoint(self, checkpoint_path: str, require_weights: bool = True) -> bool:
        path = Path(checkpoint_path)
        if not path.exists():
            if require_weights:
                raise ModelWeightsNotFoundError(f"Checkpoint not found: {checkpoint_path}")
            return False

        try:
            checkpoint = torch.load(path, map_location=self.device, weights_only=False)
            state_dict = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))
            if isinstance(checkpoint, dict) and "config" in checkpoint:
                saved = checkpoint["config"]
                if isinstance(saved, dict):
                    from configs.experiment_config import ExperimentConfig

                    self.config = ExperimentConfig.from_dict(saved)
            self.model = build_model(self.config).to(self.device)
            self.model.load_state_dict(state_dict, strict=False)
            return True
        except FileNotFoundError as exc:
            if require_weights:
                raise ModelWeightsNotFoundError(f"Checkpoint not found: {checkpoint_path}") from exc
            return False
        except (RuntimeError, KeyError, TypeError) as exc:
            if require_weights:
                raise ModelWeightsNotFoundError(f"Failed to load checkpoint: {checkpoint_path}") from exc
            return False

    def predict(self, image: np.ndarray) -> np.ndarray:
        if not self.weights_loaded:
            raise ModelWeightsNotFoundError("Predictor has no loaded weights.")
        return predict_volume_numpy(self.model, image, self.config, self.device)
