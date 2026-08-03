"""Load and cache predictors from local paths or S3 object keys."""

from __future__ import annotations

import tempfile
from pathlib import Path

from inference.predict import ModelWeightsNotFoundError, Predictor
from inference.preprocess import storage_client
from inference.runtime_settings import get_settings

settings = get_settings()


class ModelManager:
    def __init__(self) -> None:
        self._cache: dict[str, Predictor] = {}
        self._default_key = self._default_weights_key()

    def _default_weights_key(self) -> str:
        version = settings.model_version.replace("/", "_")
        return f"ai-checkpoints/{version}/weights_parameter_file.pt"

    def resolve_weights_key(self, weights_s3_path: str | None) -> str:
        if weights_s3_path:
            return weights_s3_path
        if Path(settings.model_checkpoint_path).exists():
            return f"local:{settings.model_checkpoint_path}"
        return self._default_key

    def _download_weights(self, weights_key: str) -> Path:
        if weights_key.startswith("local:"):
            return Path(weights_key.removeprefix("local:"))

        try:
            data = storage_client.download(weights_key)
        except Exception as exc:
            raise ModelWeightsNotFoundError(
                f"Model weights not found at s3://{settings.s3_bucket_name}/{weights_key}"
            ) from exc

        if not data:
            raise ModelWeightsNotFoundError(f"Model weights object is empty: {weights_key}")

        with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as tmp:
            tmp.write(data)
            path = Path(tmp.name)
        return path

    def get_predictor(self, weights_s3_path: str | None = None) -> Predictor:
        weights_key = self.resolve_weights_key(weights_s3_path)
        if weights_key in self._cache:
            return self._cache[weights_key]

        local_path = self._download_weights(weights_key)
        try:
            predictor = Predictor(str(local_path), require_weights=True)
        finally:
            if not weights_key.startswith("local:"):
                local_path.unlink(missing_ok=True)

        self._cache[weights_key] = predictor
        return predictor

    def weights_available(self, weights_s3_path: str | None = None) -> bool:
        weights_key = self.resolve_weights_key(weights_s3_path)
        if weights_key.startswith("local:"):
            return Path(weights_key.removeprefix("local:")).exists()
        return storage_client.object_exists(weights_key)

    @property
    def weights_loaded(self) -> bool:
        return bool(self._cache) or self.weights_available()


model_manager = ModelManager()
