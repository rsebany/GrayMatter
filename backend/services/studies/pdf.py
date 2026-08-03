"""One-page hippocampus MRI study PDF report (metrics, viewer QR)."""
from __future__ import annotations

from io import BytesIO

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import qrcode
from matplotlib.backends.backend_pdf import PdfPages

# (label, volume in mL or None)
PerClassRow = tuple[str, float | None]

__all__ = ["PerClassRow", "build_ild_study_report_pdf"]


def build_ild_study_report_pdf(
    *,
    study_id: str,
    patient_name: str,
    acquisition_label: str,
    total_ild_volume_ml: float,
    ild_burden_fraction: float,
    lung_volume_ml: float,
    zonal_distribution: dict[str, float],
    per_class_volumes: list[PerClassRow],
    viewer_url_for_qr: str,
) -> bytes:
    """Return PDF bytes (one A4 page). ``ild_burden_fraction`` is 0..1; displayed as percent."""
    ild_fraction_pct = float(ild_burden_fraction or 0.0) * 100.0
    zonal = zonal_distribution or {}
    total_ild_ml = float(total_ild_volume_ml or 0.0)
    lung_vol = float(lung_volume_ml or 0.0)

    buf = BytesIO()
    with PdfPages(buf) as _pdf:
        fig = plt.figure(figsize=(8.27, 11.69))
        fig.patch.set_facecolor("white")
        ax = fig.add_axes([0, 0, 1, 1])
        ax.axis("off")

        y = 0.95
        ax.text(0.08, y, "Hippocampus MRI Study Report", fontsize=20, fontweight="bold", va="top")
        y -= 0.06
        ax.text(0.08, y, f"Study ID: {study_id}", fontsize=11, va="top")
        y -= 0.03
        ax.text(0.08, y, f"Patient: {patient_name}", fontsize=11, va="top")
        y -= 0.03
        ax.text(0.08, y, f"Acquisition Date: {acquisition_label}", fontsize=11, va="top")

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=1,
        )
        qr.add_data(viewer_url_for_qr)
        qr.make(fit=True)
        qr_image = qr.make_image(fill_color="black", back_color="white")
        qr_array = np.array(qr_image.convert("L"))

        qr_ax = fig.add_axes([0.68, 0.76, 0.24, 0.2])
        qr_ax.imshow(qr_array, cmap="gray", interpolation="nearest")
        qr_ax.axis("off")
        ax.text(0.8, 0.74, "Scan to open study", fontsize=9, ha="center", color="#555555")

        y = 0.68
        ax.text(0.08, y, "Quantitative Metrics", fontsize=14, fontweight="bold", va="top")
        y -= 0.04
        ax.text(0.1, y, f"Total hippocampus volume: {total_ild_ml:.2f} mL", fontsize=11, va="top")
        y -= 0.03
        ax.text(0.1, y, f"Hippocampus burden: {ild_fraction_pct:.2f}%", fontsize=11, va="top")
        if lung_vol > 0:
            y -= 0.03
            ax.text(0.1, y, f"Intracranial reference: {lung_vol:.0f} mL", fontsize=11, va="top")

        y -= 0.05
        ax.text(0.08, y, "Per-class volumes", fontsize=14, fontweight="bold", va="top")
        y -= 0.04
        any_class = False
        for label, value_ml in per_class_volumes:
            if value_ml is None:
                continue
            try:
                vol_ml = float(value_ml)
            except (TypeError, ValueError):
                continue
            any_class = True
            burden_pct = (vol_ml / total_ild_ml * 100.0) if total_ild_ml > 0 else 0.0
            ax.text(
                0.1,
                y,
                f"{label}: {vol_ml:.2f} mL ({burden_pct:.2f}% of total hippocampus)",
                fontsize=11,
                va="top",
            )
            y -= 0.03
        if not any_class:
            ax.text(0.1, y, "No per-class biomarkers available.", fontsize=11, va="top")
            y -= 0.03

        y -= 0.02
        ax.text(0.08, y, "Zonal Distribution (Upper / Middle / Lower)", fontsize=14, fontweight="bold", va="top")
        y -= 0.04
        if zonal:
            for zone in sorted(zonal.keys()):
                try:
                    value = float(zonal[zone])
                except (TypeError, ValueError):
                    continue
                ax.text(0.1, y, f"{zone}: {value:.2f}%", fontsize=11, va="top")
                y -= 0.03
        else:
            ax.text(0.1, y, "No zonal distribution available.", fontsize=11, va="top")
            y -= 0.03

        y -= 0.04
        ax.text(
            0.08,
            y,
            "Generated automatically by GrayMatter analytics.",
            fontsize=9,
            color="#555555",
            va="top",
        )

        _pdf.savefig(fig, bbox_inches="tight")
        plt.close(fig)

    buf.seek(0)
    return buf.read()
