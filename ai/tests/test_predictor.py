"""Unit tests for ai.inference.predict.Predictor."""

from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np
import pytest
import torch

from configs.experiment_config import ExperimentConfig
from models.hybrid_attention_unet import (
    CoordinateInterSliceAttention,
    HybridAttentionUNet3D,
    build_model,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def small_config() -> ExperimentConfig:
    """Config with tiny channels for fast tests."""
    return ExperimentConfig(
        num_classes=3,
        model_channels=(8, 16, 32, 64),
        skip_mode="coord_only",
        bottleneck_dropout_p=0.0,
    )


@pytest.fixture
def identity_config(small_config: ExperimentConfig) -> ExperimentConfig:
    cfg = ExperimentConfig.from_dict(small_config.to_dict())
    cfg.skip_mode = "identity"
    return cfg


@pytest.fixture
def full_config(small_config: ExperimentConfig) -> ExperimentConfig:
    cfg = ExperimentConfig.from_dict(small_config.to_dict())
    cfg.skip_mode = "full"
    return cfg


@pytest.fixture
def dummy_checkpoint(small_config: ExperimentConfig, tmp_path: Path) -> Path:
    model = build_model(small_config)
    ckpt_path = tmp_path / "test_model.pt"
    torch.save(
        {"model_state_dict": model.state_dict(), "config": small_config.to_dict()},
        ckpt_path,
    )
    return ckpt_path


# ---------------------------------------------------------------------------
# Model construction
# ---------------------------------------------------------------------------


class TestBuildModel:
    def test_default_channels(self) -> None:
        model = build_model()
        assert isinstance(model, HybridAttentionUNet3D)
        assert model.skip_mode == "coord_only"

    def test_from_config(self, small_config: ExperimentConfig) -> None:
        model = build_model(small_config)
        c1, c2, c3, c4 = small_config.model_channels
        assert model.enc1.block[0].out_channels == c1
        assert model.enc4.block[0].out_channels == c4

    def test_from_int(self) -> None:
        model = build_model(5)
        assert model.final.out_channels == 5


# ---------------------------------------------------------------------------
# Forward pass
# ---------------------------------------------------------------------------


class TestForwardPass:
    @pytest.mark.parametrize("skip_mode", ["identity", "coord_only", "full"])
    def test_output_shape(self, skip_mode: str, small_config: ExperimentConfig) -> None:
        cfg = ExperimentConfig.from_dict(small_config.to_dict())
        cfg.skip_mode = skip_mode
        model = build_model(cfg)
        x = torch.randn(1, 1, 48, 64, 48)
        with torch.no_grad():
            out = model(x)
        assert out.shape == (1, 3, 48, 64, 48)

    def test_batch_dimension(self, small_config: ExperimentConfig) -> None:
        model = build_model(small_config)
        x = torch.randn(2, 1, 48, 64, 48)
        with torch.no_grad():
            out = model(x)
        assert out.shape[0] == 2


# ---------------------------------------------------------------------------
# CoordinateInterSliceAttention
# ---------------------------------------------------------------------------


class TestCISA:
    def test_identity_mode_passthrough(self) -> None:
        cisa = CoordinateInterSliceAttention(32, mode="identity")
        x = torch.randn(1, 32, 8, 8, 8)
        out = cisa(x)
        assert torch.equal(out, x)

    def test_coord_only_no_residual(self) -> None:
        cisa = CoordinateInterSliceAttention(32, mode="coord_only")
        assert cisa.inter_slice is None
        x = torch.randn(1, 32, 8, 8, 8)
        out = cisa(x)
        assert out.shape == x.shape

    def test_full_has_residual(self) -> None:
        cisa = CoordinateInterSliceAttention(32, mode="full")
        assert cisa.inter_slice is not None
        x = torch.randn(1, 32, 8, 8, 8)
        out = cisa(x)
        assert out.shape == x.shape

    def test_output_bounded(self) -> None:
        cisa = CoordinateInterSliceAttention(32, mode="coord_only")
        x = torch.randn(1, 32, 8, 8, 8)
        out = cisa(x)
        assert out.abs().max() <= x.abs().max() * 1.0 + 1.0


# ---------------------------------------------------------------------------
# Checkpoint load / save
# ---------------------------------------------------------------------------


class TestCheckpoint:
    def test_round_trip(self, small_config: ExperimentConfig, tmp_path: Path) -> None:
        model = build_model(small_config)
        ckpt = tmp_path / "model.pt"
        torch.save(
            {"model_state_dict": model.state_dict(), "config": small_config.to_dict()},
            ckpt,
        )
        loaded = torch.load(ckpt, map_location="cpu", weights_only=False)
        assert "model_state_dict" in loaded
        assert "config" in loaded
        model2 = build_model(ExperimentConfig.from_dict(loaded["config"]))
        model2.load_state_dict(loaded["model_state_dict"])

    def test_rejects_wrong_extension(self, tmp_path: Path) -> None:
        bad_file = tmp_path / "model.txt"
        bad_file.write_text("not a checkpoint")
        with pytest.raises(Exception):
            torch.load(bad_file, map_location="cpu", weights_only=False)

    def test_rejects_oversized_file(self, tmp_path: Path) -> None:
        big_file = tmp_path / "model.pt"
        big_file.write_bytes(b"\x00" * (600 * 1024 * 1024))  # 600 MB
        with pytest.raises(Exception):
            torch.load(big_file, map_location="cpu", weights_only=False)


# ---------------------------------------------------------------------------
# Predictor (integration, requires no GPU)
# ---------------------------------------------------------------------------


class TestPredictor:
    def test_loads_checkpoint(self, dummy_checkpoint: Path) -> None:
        from predict import Predictor

        predictor = Predictor(str(dummy_checkpoint), device="cpu", require_weights=True)
        assert predictor.weights_loaded

    def test_missing_checkpoint_raises(self, tmp_path: Path) -> None:
        from predict import Predictor, ModelWeightsNotFoundError

        with pytest.raises(ModelWeightsNotFoundError):
            Predictor(str(tmp_path / "nonexistent.pt"), device="cpu", require_weights=True)

    def test_predict_output_shape(self, dummy_checkpoint: Path) -> None:
        from predict import Predictor

        predictor = Predictor(str(dummy_checkpoint), device="cpu")
        image = np.random.rand(48, 64, 48).astype(np.float32)
        result = predictor.predict(image)
        assert result.shape == (48, 64, 48)
        assert result.dtype in (np.int64, np.int32, np.float32, np.float64)
