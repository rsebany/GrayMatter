"""Pure-Python checks for the Slicer integration core."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
import base64
import io
import zipfile
from pathlib import Path
from unittest.mock import patch

import numpy as np

MODULE_DIR = Path(__file__).resolve().parents[1] / "GrayMatterSlicer"
sys.path.insert(0, str(MODULE_DIR))

import GrayMatterSlicerCore as core  # noqa: E402


class GrayMatterSlicerCoreTests(unittest.TestCase):
    def _geometry(self):
        return {
            "depth": 2,
            "height": 2,
            "width": 2,
            "spacing_z_mm": 1.5,
            "spacing_y_mm": 0.8,
            "spacing_x_mm": 0.8,
        }

    def _mask(self):
        return np.array(
            [[[0, 1], [0, 0]], [[0, 0], [2, 0]]],
            dtype=np.uint8,
        )

    def test_accepts_contract_labels_and_geometry(self):
        mask = np.zeros((2, 3, 4), dtype=np.uint8)
        mask[0, 0, 0] = 1
        mask[1, 2, 3] = 2

        self.assertEqual(core.validate_allowed_labels(mask), (0, 1, 2))
        core.validate_geometry(
            mask,
            expected_shape_zyx=(2, 3, 4),
            expected_spacing_zyx=(1.5, 0.8, 0.8),
            actual_spacing_zyx=(1.5, 0.8, 0.8),
        )

    def test_rejects_unknown_label(self):
        mask = np.zeros((2, 2, 2), dtype=np.uint8)
        mask[0, 0, 0] = 3
        with self.assertRaisesRegex(ValueError, "unsupported labels"):
            core.validate_allowed_labels(mask)

    def test_rejects_shape_and_spacing_mismatch(self):
        mask = np.zeros((2, 3, 4), dtype=np.uint8)
        with self.assertRaisesRegex(ValueError, "Mask shape"):
            core.validate_geometry(mask, (2, 3, 5), (1, 1, 1), (1, 1, 1))
        with self.assertRaisesRegex(ValueError, "Volume spacing"):
            core.validate_geometry(mask, (2, 3, 4), (1, 1, 1), (1.1, 1, 1))

    def test_nifti_axes_round_trip_between_server_and_slicer(self):
        manifest = {
            "imaging_source": "nifti",
            "shape_zyx": [34, 56, 28],
            "spacing_zyx_mm": [1.2, 0.8, 0.6],
        }
        server_mask = np.zeros((34, 56, 28), dtype=np.uint8)
        server_mask[3, 4, 5] = 1
        server_mask[30, 40, 20] = 2

        shape, spacing = core.slicer_geometry_from_manifest(manifest)
        self.assertEqual(shape, (28, 56, 34))
        self.assertEqual(spacing, (0.6, 0.8, 1.2))

        slicer_mask = core.mask_to_slicer_order(server_mask, manifest)
        self.assertEqual(slicer_mask.shape, shape)
        np.testing.assert_array_equal(
            core.mask_from_slicer_order(slicer_mask, manifest),
            server_mask,
        )

    def test_payload_uses_label_contract_without_credentials(self):
        mask = np.zeros((1, 2, 3), dtype=np.uint8)
        payload = core.build_revision_payload(mask, (1.0, 0.8, 0.8), "reviewed")

        self.assertEqual(payload["labels"], core.LABELS)
        self.assertEqual(payload["geometry"]["shape_zyx"], [1, 2, 3])
        self.assertNotIn("token", json.dumps(payload).lower())

    def test_manifest_writer_rejects_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "manifest.json"
            with self.assertRaisesRegex(ValueError, "secret field"):
                core.write_manifest(destination, {"study_id": "ST-test", "token": "secret"})
            self.assertFalse(destination.exists())

    def test_api_base_validation(self):
        self.assertEqual(
            core.normalize_api_base(" http://localhost/api/ "),
            "http://localhost/api",
        )
        with self.assertRaisesRegex(ValueError, "http"):
            core.normalize_api_base("localhost/api")
        with self.assertRaisesRegex(ValueError, "credentials"):
            core.normalize_api_base("http://localhost/api?access_token=secret")

    def test_credential_manager_payload_round_trip(self):
        raw = core._encode_saved_session(
            "http://localhost/api/",
            "radiologist@example.test",
            "session-token",
        )
        saved = core._decode_saved_session(raw)
        self.assertEqual(saved["api_base"], "http://localhost/api")
        self.assertEqual(saved["email"], "radiologist@example.test")
        self.assertEqual(saved["token"], "session-token")
        with self.assertRaisesRegex(ValueError, "session token"):
            core._encode_saved_session(
                "http://localhost/api",
                "radiologist@example.test",
                "",
            )

    def test_pull_dicom_workspace_and_round_trip_mask_equality(self):
        mask = self._mask()
        archive_buffer = io.BytesIO()
        with zipfile.ZipFile(archive_buffer, "w") as archive:
            archive.writestr("series/image001.dcm", b"DICOM")

        def fake_json(_base, path, _token=None, payload=None):
            self.assertIsNone(payload)
            if path.endswith("/dicom-shape"):
                return self._geometry()
            if path.endswith("/mesh"):
                return {"mesh_url": "/mesh.glb"}
            raise AssertionError(path)

        def fake_request(_base, path, token=None, payload=None, timeout_s=180):
            self.assertEqual(token, "session-token")
            self.assertIsNone(payload)
            if path.endswith("/mask"):
                return mask.tobytes(), {"x-mask-shape": "2,2,2"}
            if path.endswith("/dicom-zip"):
                return archive_buffer.getvalue(), {}
            raise AssertionError(path)

        with tempfile.TemporaryDirectory() as directory, patch.object(
            core, "request_json", side_effect=fake_json
        ), patch.object(core, "_request", side_effect=fake_request):
            manifest = core.pull_workspace(
                "https://graymatter.example/api",
                "ST-dicom",
                "session-token",
                Path(directory),
            )
            self.assertEqual(manifest["imaging_source"], "dicom")
            self.assertTrue((Path(directory) / "dicom" / "series" / "image001.dcm").is_file())
            pulled = np.load(manifest["mask_path"], allow_pickle=False)
            np.testing.assert_array_equal(pulled, mask)
            payload = core.build_revision_payload(
                pulled, manifest["spacing_zyx_mm"], "round trip"
            )
            decoded = np.frombuffer(
                base64.b64decode(payload["mask_b64"]),
                dtype=np.uint8,
            ).reshape(payload["geometry"]["shape_zyx"])
            np.testing.assert_array_equal(decoded, mask)
            self.assertNotIn("token", json.dumps(manifest).lower())

    def test_pull_falls_back_to_nifti_workspace(self):
        mask = self._mask()

        def fake_json(_base, path, _token=None, payload=None):
            if path.endswith("/dicom-shape"):
                return self._geometry()
            if path.endswith("/mesh"):
                return {}
            raise AssertionError(path)

        def fake_request(_base, path, token=None, payload=None, timeout_s=180):
            if path.endswith("/mask"):
                return mask.tobytes(), {"x-mask-shape": "2,2,2"}
            if path.endswith("/dicom-zip"):
                raise RuntimeError("not available")
            if path.endswith("/nifti"):
                return b"NIFTI", {
                    "content-disposition": 'attachment; filename="../../study.nii.gz"'
                }
            raise AssertionError(path)

        with tempfile.TemporaryDirectory() as directory, patch.object(
            core, "request_json", side_effect=fake_json
        ), patch.object(core, "_request", side_effect=fake_request):
            manifest = core.pull_workspace(
                "https://graymatter.example/api",
                "ST-nifti",
                "session-token",
                Path(directory),
            )
            self.assertEqual(manifest["imaging_source"], "nifti")
            self.assertEqual(Path(manifest["nifti_path"]).name, "study.nii.gz")
            self.assertEqual(Path(manifest["nifti_path"]).read_bytes(), b"NIFTI")
            self.assertNotIn("not available", manifest["imaging_note"])

    def test_push_exchanges_session_token_without_persisting_scoped_token(self):
        mask = self._mask()
        calls = []

        def fake_json(_base, path, token=None, payload=None):
            calls.append((path, token, payload))
            if path == "/auth/slicer-token":
                return {"access_token": "ephemeral-scoped-token"}
            return {"revision_id": 7, "status": "accepted"}

        with patch.object(core, "request_json", side_effect=fake_json):
            result = core.push_revision(
                "https://graymatter.example/api",
                "ST-push",
                "normal-session-token",
                mask,
                (1.5, 0.8, 0.8),
                "edited",
            )
        self.assertEqual(result["revision_id"], 7)
        self.assertEqual(calls[0][0:2], ("/auth/slicer-token", "normal-session-token"))
        self.assertEqual(calls[1][1], "ephemeral-scoped-token")
        self.assertNotIn("ephemeral-scoped-token", json.dumps(calls[1][2]))


if __name__ == "__main__":
    unittest.main()
