from typing import Literal, Sequence

import torch
import torch.nn as nn

from configs.experiment_config import ExperimentConfig

SkipMode = Literal["identity", "coord_only", "full", "attention_gate"]


def _group_norm(num_channels: int) -> nn.GroupNorm:
    groups = min(8, num_channels)
    while groups > 1 and num_channels % groups != 0:
        groups -= 1
    return nn.GroupNorm(groups, num_channels)


class DoubleConv3D(nn.Module):
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv3d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            _group_norm(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv3d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
            _group_norm(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class AttentionGate3D(nn.Module):
    """Additive attention gate (Oktay et al. 2018) for 3D volumes.

    Takes encoder skip features (x) and decoder gating signal (g),
    computes attention coefficients via additive attention, and
    returns attention-weighted skip features.
    """

    def __init__(self, F_g: int, F_l: int, F_int: int):
        super().__init__()
        self.W_g = nn.Sequential(
            nn.Conv3d(F_g, F_int, kernel_size=1, stride=1, padding=0, bias=True),
            nn.BatchNorm3d(F_int),
        )
        self.W_x = nn.Sequential(
            nn.Conv3d(F_l, F_int, kernel_size=1, stride=1, padding=0, bias=True),
            nn.BatchNorm3d(F_int),
        )
        self.psi = nn.Sequential(
            nn.Conv3d(F_int, 1, kernel_size=1, stride=1, padding=0, bias=True),
            nn.BatchNorm3d(1),
            nn.Sigmoid(),
        )
        self.relu = nn.ReLU(inplace=True)

    def forward(self, g: torch.Tensor, x: torch.Tensor) -> torch.Tensor:
        g1 = self.W_g(g)
        x1 = self.W_x(x)
        psi = self.relu(g1 + x1)
        psi = self.psi(psi)
        return x * psi


class CoordinateInterSliceAttention(nn.Module):
    """Full CISA: coordinate gating + axial depthwise inter-slice context."""

    def __init__(self, channels: int, reduction: int = 8, mode: SkipMode = "full"):
        super().__init__()
        self.mode = mode
        if mode == "identity" or mode == "attention_gate":
            return

        mid = max(channels // reduction, 8)

        def _coord_branch() -> nn.Sequential:
            return nn.Sequential(
                nn.Conv3d(channels, mid, kernel_size=1, bias=False),
                nn.ReLU(inplace=True),
                nn.Conv3d(mid, channels, kernel_size=1, bias=False),
            )

        self.branch_d = _coord_branch()
        self.branch_h = _coord_branch()
        self.branch_w = _coord_branch()
        self.sigmoid = nn.Sigmoid()

        if mode == "full":
            self.inter_slice = nn.Sequential(
                nn.Conv3d(
                    channels, channels, kernel_size=(3, 1, 1),
                    padding=(1, 0, 0), groups=channels, bias=False,
                ),
                _group_norm(channels),
                nn.ReLU(inplace=True),
            )
        else:
            self.inter_slice = None

    def forward(self, x: torch.Tensor, g: torch.Tensor | None = None) -> torch.Tensor:
        if self.mode == "identity" or self.mode == "attention_gate":
            return x
        mean_d = x.mean(dim=2, keepdim=True)
        mean_h = x.mean(dim=3, keepdim=True)
        mean_w = x.mean(dim=4, keepdim=True)
        gated = x * self.sigmoid(self.branch_d(mean_d))
        gated = gated * self.sigmoid(self.branch_h(mean_h))
        gated = gated * self.sigmoid(self.branch_w(mean_w))

        if self.mode == "coord_only":
            return gated

        assert self.inter_slice is not None
        return gated + self.inter_slice(gated)


def _make_skip_enhancer(channels: int, skip_mode: SkipMode,
                        gating_channels: int | None = None) -> nn.Module:
    if skip_mode == "identity":
        return nn.Identity()
    if skip_mode == "attention_gate":
        F_int = max(channels // 2, 8)
        return AttentionGate3D(F_g=gating_channels or channels, F_l=channels, F_int=F_int)
    return CoordinateInterSliceAttention(channels, mode=skip_mode)


class LightweightHybridAttentionUNet3D(nn.Module):
    def __init__(
        self,
        in_channels: int = 1,
        out_channels: int = 3,
        channels: Sequence[int] = (32, 64, 128, 256),
        bottleneck_dropout_p: float = 0.1,
        skip_mode: SkipMode = "full",
    ):
        super().__init__()
        if len(channels) != 4:
            raise ValueError("channels must contain exactly 4 values")
        c1, c2, c3, c4 = channels
        self.skip_mode = skip_mode

        self.enc1 = DoubleConv3D(in_channels, c1)
        self.enc2 = DoubleConv3D(c1, c2)
        self.enc3 = DoubleConv3D(c2, c3)
        self.enc4 = DoubleConv3D(c3, c4)
        self.pool = nn.MaxPool3d(kernel_size=2, stride=2)
        self.bottleneck = DoubleConv3D(c4, c4)
        self.bottleneck_drop = (
            nn.Dropout3d(p=bottleneck_dropout_p) if bottleneck_dropout_p > 0 else nn.Identity()
        )

        if skip_mode == "attention_gate":
            self.skip4 = _make_skip_enhancer(c4, skip_mode, gating_channels=c4)
            self.skip3 = _make_skip_enhancer(c3, skip_mode, gating_channels=c3)
            self.skip2 = _make_skip_enhancer(c2, skip_mode, gating_channels=c2)
            self.skip1 = _make_skip_enhancer(c1, skip_mode, gating_channels=c1)
        else:
            self.skip4 = _make_skip_enhancer(c4, skip_mode)
            self.skip3 = _make_skip_enhancer(c3, skip_mode)
            self.skip2 = _make_skip_enhancer(c2, skip_mode)
            self.skip1 = _make_skip_enhancer(c1, skip_mode)

        self.up4 = nn.ConvTranspose3d(c4, c4, kernel_size=2, stride=2)
        self.dec4 = DoubleConv3D(c4 + c4, c4)
        self.up3 = nn.ConvTranspose3d(c4, c3, kernel_size=2, stride=2)
        self.dec3 = DoubleConv3D(c3 + c3, c3)
        self.up2 = nn.ConvTranspose3d(c3, c2, kernel_size=2, stride=2)
        self.dec2 = DoubleConv3D(c2 + c2, c2)
        self.up1 = nn.ConvTranspose3d(c2, c1, kernel_size=2, stride=2)
        self.dec1 = DoubleConv3D(c1 + c1, c1)
        self.final = nn.Conv3d(c1, out_channels, kernel_size=1)

    def _apply_skip(self, skip_module: nn.Module, skip_feat: torch.Tensor,
                    gate_feat: torch.Tensor | None = None) -> torch.Tensor:
        if self.skip_mode == "attention_gate":
            return skip_module(gate_feat, skip_feat)
        return skip_module(skip_feat)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))
        b = self.bottleneck_drop(self.bottleneck(self.pool(e4)))

        u4 = self.up4(b)
        d4 = self.dec4(torch.cat([u4, self._apply_skip(self.skip4, e4, u4)], dim=1))
        u3 = self.up3(d4)
        d3 = self.dec3(torch.cat([u3, self._apply_skip(self.skip3, e3, u3)], dim=1))
        u2 = self.up2(d3)
        d2 = self.dec2(torch.cat([u2, self._apply_skip(self.skip2, e2, u2)], dim=1))
        u1 = self.up1(d2)
        d1 = self.dec1(torch.cat([u1, self._apply_skip(self.skip1, e1, u1)], dim=1))
        return self.final(d1)


def build_model(config: ExperimentConfig | int | None = None) -> LightweightHybridAttentionUNet3D:
    if isinstance(config, ExperimentConfig):
        return LightweightHybridAttentionUNet3D(
            in_channels=1,
            out_channels=config.num_classes,
            channels=config.model_channels,
            bottleneck_dropout_p=config.bottleneck_dropout_p,
            skip_mode=config.skip_mode,
        )
    num_classes = 3 if config is None else int(config)
    return LightweightHybridAttentionUNet3D(in_channels=1, out_channels=num_classes)
