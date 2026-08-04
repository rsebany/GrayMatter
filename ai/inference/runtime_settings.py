"""Runtime settings for ai/inference without the removed ai/service package.

Reads environment variables used by the Docker/backend stack.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _repo_ai_root() -> Path:
    return Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class RuntimeSettings:
    experiment_config_path: Path | None
    model_checkpoint_path: Path
    model_version: str
    s3_endpoint_url: str
    s3_access_key_id: str
    s3_secret_access_key: str
    s3_region: str
    s3_use_ssl: bool
    s3_bucket_name: str


@lru_cache(maxsize=1)
def get_settings() -> RuntimeSettings:
    ai_root = Path(os.environ.get("GRAYMATTER_AI_ROOT", str(_repo_ai_root()))).resolve()
    default_ckpt = ai_root / "checkpoints" / "model.pt"
    default_config = ai_root / "configs" / "hybrid_attention_v1.json"

    config_env = os.environ.get("GRAYMATTER_EXPERIMENT_CONFIG", "").strip()
    config_path = Path(config_env) if config_env else default_config
    if not config_path.is_file():
        config_path = None

    ckpt_env = os.environ.get("GRAYMATTER_CHECKPOINT", "").strip()
    ckpt_path = Path(ckpt_env) if ckpt_env else default_ckpt

    return RuntimeSettings(
        experiment_config_path=config_path,
        model_checkpoint_path=ckpt_path,
        model_version=os.environ.get("GRAYMATTER_MODEL_VERSION", "v1.0.0-coord-attention"),
        s3_endpoint_url=os.environ.get("S3_ENDPOINT_URL", "http://localhost:9000"),
        s3_access_key_id=os.environ.get("S3_ACCESS_KEY_ID", ""),
        s3_secret_access_key=os.environ.get("S3_SECRET_ACCESS_KEY", ""),
        s3_region=os.environ.get("S3_REGION", "us-east-1"),
        s3_use_ssl=os.environ.get("S3_USE_SSL", "false").lower() in {"1", "true", "yes"},
        s3_bucket_name=os.environ.get("S3_BUCKET_NAME", "graymatter"),
    )
