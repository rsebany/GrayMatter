from __future__ import annotations

import asyncio
import base64
import sys
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import numpy as np
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import routes.segmentation_sync.endpoints as sync_endpoints
from routes.auth.session_routes import slicer_token
from routes.segmentation_sync.endpoints import (
    _compensate_unaccepted_revision,
    _process_revision,
    _snapshot_segmentation_row,
)
from routes.segmentation_sync.helpers import validate_revision_labels
from routes.segmentation_sync.helpers import as_revision_info
from schemas import (
    SegmentationGeometry,
    SegmentationRevisionCreate,
    SegmentationRollbackCreate,
    SignupRequest,
    SlicerTokenRequest,
)
from pydantic import ValidationError
from auth.dependencies import get_current_user, get_slicer_integration_user
from auth.tokens import create_access_token, create_slicer_integration_token, decode_token
from services.studies.analysis_state import _analysis_cache
from services.sync.events import StudyEventHub, create_study_event_hub
from services.sync.segmentation import (
    LABEL_CONTRACT,
    accept_revision,
    atomic_save_mask,
    begin_revision,
    decode_mask,
    fail_revision,
    load_manifest,
    resolve_revision_mask_path,
)


class MaskContractTests(unittest.TestCase):
    def test_payload_defaults_to_exact_hippocampus_contract(self) -> None:
        payload = SegmentationRevisionCreate(
            geometry=SegmentationGeometry(
                shape_zyx=[1, 1, 1],
                spacing_zyx_mm=[1.0, 1.0, 1.0],
            ),
            mask_b64=base64.b64encode(b"\x00").decode("ascii"),
        )
        self.assertEqual(payload.labels, LABEL_CONTRACT)

    def test_labels_require_exact_names_and_values(self) -> None:
        self.assertEqual(validate_revision_labels(dict(LABEL_CONTRACT)), LABEL_CONTRACT)
        for invalid in (
            {"background": 0, "left": 2, "right": 1},
            {"background": 0, "left": 1, "right": 2, "other": 3},
            {"background": 0, "ggo": 1, "reticulation": 2},
        ):
            with self.subTest(invalid=invalid), self.assertRaises(HTTPException) as raised:
                validate_revision_labels(invalid)
            self.assertEqual(raised.exception.status_code, 422)

    def test_mask_decode_rejects_invalid_base64_and_values(self) -> None:
        with self.assertRaisesRegex(ValueError, "valid base64"):
            decode_mask("not base64!", (1, 1, 1))
        encoded = base64.b64encode(bytes([0, 1, 2, 3])).decode("ascii")
        with self.assertRaisesRegex(ValueError, "unsupported label values"):
            decode_mask(encoded, (1, 2, 2))


class RevisionLifecycleTests(unittest.TestCase):
    def _begin(self, root: Path, mask: np.ndarray, **metadata):
        return begin_revision(
            root,
            "ST-unit",
            source="slicer",
            revision_note="unit test",
            shape_zyx=tuple(mask.shape),
            spacing_zyx_mm=(1.0, 1.0, 1.0),
            orientation="zyx",
            labels=LABEL_CONTRACT,
            mask=mask,
            user_id="42",
            **metadata,
        )

    def test_pending_revision_is_auditable_then_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            revision = self._begin(
                root,
                np.array([[[0, 1, 2]]], dtype=np.uint8),
                module_name="GrayMatterSlicer",
                module_version="1.2",
                workstation_id="ws-7",
            )
            pending = load_manifest(root, "ST-unit")
            item = pending["revisions"][0]
            self.assertEqual(item["status"], "pending")
            self.assertEqual(item["authenticated_user_id"], "42")
            self.assertEqual(item["module_name"], "GrayMatterSlicer")
            self.assertEqual(pending["current_revision_id"], 0)
            self.assertTrue(revision.mask_path.is_file())

            accept_revision(
                root,
                "ST-unit",
                revision.revision_id,
                mesh_url="/static/meshes/test.glb",
                stl_url="/static/meshes/test.stl",
            )
            accepted = load_manifest(root, "ST-unit")
            item = accepted["revisions"][0]
            self.assertEqual(item["status"], "accepted")
            self.assertIsNotNone(item["accepted_at"])
            self.assertEqual(accepted["current_revision_id"], revision.revision_id)

    def test_failed_revision_does_not_replace_current_revision(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = self._begin(root, np.array([[[0, 1]]], dtype=np.uint8))
            accept_revision(root, "ST-unit", first.revision_id, mesh_url="", stl_url="")
            second = self._begin(root, np.array([[[0, 2]]], dtype=np.uint8))
            fail_revision(root, "ST-unit", second.revision_id, "mesh generation failed")

            manifest = load_manifest(root, "ST-unit")
            self.assertEqual(manifest["current_revision_id"], first.revision_id)
            self.assertEqual(manifest["revisions"][-1]["status"], "failed")
            self.assertEqual(
                manifest["revisions"][-1]["failure_reason"],
                "Revision processing failed.",
            )

    def test_revision_ids_are_not_reused_after_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = self._begin(root, np.array([[[0]]], dtype=np.uint8))
            fail_revision(root, "ST-unit", first.revision_id, "failed")
            second = self._begin(root, np.array([[[1]]], dtype=np.uint8))
            self.assertEqual(second.revision_id, first.revision_id + 1)

    def test_atomic_mask_failure_preserves_previous_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "active.npy"
            original = np.array([[[1]]], dtype=np.uint8)
            np.save(path, original)
            with patch(
                "services.sync.segmentation.os.replace",
                side_effect=OSError("replace failed"),
            ), self.assertRaises(OSError):
                atomic_save_mask(path, np.array([[[2]]], dtype=np.uint8))
            np.testing.assert_array_equal(
                np.load(path, allow_pickle=False),
                original,
            )

    def test_storage_rejects_traversal_and_symlink_escape(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "sync"
            outside = Path(directory) / "outside.npy"
            np.save(outside, np.zeros((1, 1, 1), dtype=np.uint8))
            with self.assertRaisesRegex(ValueError, "Invalid study"):
                load_manifest(root, "../outside")
            with self.assertRaisesRegex(ValueError, "escapes study storage"):
                resolve_revision_mask_path(root, "ST-safe", outside)

    def test_configurable_retention_preserves_current_and_prunes_old_masks(self) -> None:
        with tempfile.TemporaryDirectory() as directory, patch.dict(
            "os.environ",
            {"GRAYMATTER_SEGMENTATION_REVISION_RETENTION": "2"},
        ):
            root = Path(directory)
            current = self._begin(root, np.array([[[1]]], dtype=np.uint8))
            accept_revision(root, "ST-unit", current.revision_id, mesh_url="", stl_url="")
            failed_paths = []
            for value in (2, 1, 2):
                revision = self._begin(
                    root,
                    np.array([[[value]]], dtype=np.uint8),
                )
                failed_paths.append(revision.mask_path)
                fail_revision(root, "ST-unit", revision.revision_id, "private detail")
            manifest = load_manifest(root, "ST-unit")
            ids = {item["revision_id"] for item in manifest["revisions"]}
            self.assertIn(current.revision_id, ids)
            self.assertLessEqual(len(manifest["revisions"]), 3)
            self.assertFalse(failed_paths[0].exists())
            self.assertTrue(current.mask_path.exists())

    def test_revision_history_redacts_internal_audit_metadata(self) -> None:
        item = {
            "revision_id": 1,
            "source": "slicer",
            "revision_note": "reviewed",
            "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-01T00:00:01+00:00",
            "failed_at": "2026-01-01T00:00:01+00:00",
            "status": "failed",
            "failure_reason": "C:\\patient\\name\\private.dcm",
            "authenticated_user_id": "42",
            "workstation_id": "radiology-workstation",
            "geometry": {
                "shape_zyx": [1, 1, 1],
                "spacing_zyx_mm": [1.0, 1.0, 1.0],
                "orientation": "zyx",
            },
            "labels": LABEL_CONTRACT,
        }
        response = as_revision_info("ST-unit", item)
        self.assertEqual(response.failure_reason, "Revision processing failed.")
        self.assertIsNone(response.authenticated_user_id)
        self.assertIsNone(response.workstation_id)


class SlicerTokenTests(unittest.TestCase):
    def _claims(self):
        return {
            "sub": "42",
            "email": "user@example.test",
            "role": "radiologist",
            "medical_id": "M-42",
            "full_name": "Test User",
        }

    def test_scoped_token_is_short_lived_and_study_bound(self) -> None:
        token, _expires = create_slicer_integration_token(self._claims(), "ST-one")
        payload = decode_token(token)
        self.assertEqual(payload["token_type"], "slicer_integration")
        self.assertEqual(payload["scope"], "segmentation:write")
        self.assertEqual(payload["study_id"], "ST-one")

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = asyncio.run(get_slicer_integration_user("ST-one", credentials))
        self.assertEqual(user.sub, "42")
        with self.assertRaises(HTTPException) as wrong_study:
            asyncio.run(get_slicer_integration_user("ST-two", credentials))
        self.assertEqual(wrong_study.exception.status_code, 403)

    def test_public_signup_cannot_self_assign_admin(self) -> None:
        with self.assertRaises(ValidationError):
            SignupRequest(
                full_name="Attacker",
                email="attacker@example.test",
                role="admin",
                password="long-enough-password",
            )

    def test_integration_token_cannot_act_as_normal_web_session(self) -> None:
        token, _expires = create_slicer_integration_token(self._claims(), "ST-one")
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(get_current_user(credentials))
        self.assertEqual(raised.exception.status_code, 401)

        access = create_access_token(self._claims())
        normal = asyncio.run(
            get_current_user(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=access)
            )
        )
        self.assertEqual(normal.token_type, "access")

        malformed = create_access_token({"sub": "42"})
        with self.assertRaises(HTTPException):
            asyncio.run(
                get_current_user(
                    HTTPAuthorizationCredentials(
                        scheme="Bearer",
                        credentials=malformed,
                    )
                )
            )

    def test_referring_physician_cannot_issue_or_rollback_revisions(self) -> None:
        referring = SimpleNamespace(role="referring_physician")
        with self.assertRaises(HTTPException) as token_denied:
            slicer_token(SlicerTokenRequest(study_id="ST-one"), referring)
        self.assertEqual(token_denied.exception.status_code, 403)

        with self.assertRaises(HTTPException) as rollback_denied:
            asyncio.run(
                sync_endpoints.rollback_segmentation_revision(
                    "ST-one",
                    1,
                    SegmentationRollbackCreate(),
                    referring,
                )
            )
        self.assertEqual(rollback_denied.exception.status_code, 403)


class EventTransportTests(unittest.TestCase):
    def test_memory_transport_fans_out_without_replaying_events(self) -> None:
        async def exercise():
            hub = StudyEventHub()
            await hub.publish("ST-events", {"event": "before-subscribe"})
            subscription = hub.subscribe("ST-events")
            pending = asyncio.create_task(subscription.__anext__())
            await asyncio.sleep(0)
            accepted = {"event": "segmentation.updated", "revision_id": 3}
            await hub.publish("ST-events", accepted)
            result = await asyncio.wait_for(pending, timeout=1)
            await subscription.aclose()
            return result

        self.assertEqual(asyncio.run(exercise())["revision_id"], 3)

    def test_redis_configuration_without_url_has_clean_memory_fallback(self) -> None:
        with patch.dict(
            "os.environ",
            {"GRAYMATTER_EVENT_BACKEND": "redis", "GRAYMATTER_REDIS_URL": ""},
        ):
            self.assertIsInstance(create_study_event_hub(), StudyEventHub)


class RevisionCompensationTests(unittest.TestCase):
    def test_compensation_restores_mask_database_fields_and_cache(self) -> None:
        study_id = "ST-compensate"
        original_cache = {"mesh_url": "/old.glb", "mask": np.array([[[1]]])}
        original_segmentation = SimpleNamespace(
            total_ild_volume_ml=1.0,
            mesh_url="/old.glb",
            mask_path="/old.npy",
            zonal_distribution={"Upper": 100.0},
        )
        snapshot = _snapshot_segmentation_row(original_segmentation)
        original_segmentation.total_ild_volume_ml = 9.0
        original_segmentation.mesh_url = "/failed.glb"
        original_segmentation.mask_path = "/failed.npy"
        original_segmentation.zonal_distribution = {"Lower": 100.0}
        fake_study = SimpleNamespace(segmentation=original_segmentation)
        fake_session = SimpleNamespace(flush=lambda: None)

        @contextmanager
        def fake_get_session():
            yield fake_session

        with tempfile.TemporaryDirectory() as directory:
            active_path = Path(directory) / "active.npy"
            previous_mask = np.array([[[1]]], dtype=np.uint8)
            np.save(active_path, np.array([[[2]]], dtype=np.uint8))
            _analysis_cache[study_id] = {
                "mesh_url": "/failed.glb",
                "mask": np.array([[[2]]]),
            }
            try:
                with patch(
                    "routes.segmentation_sync.endpoints.get_session",
                    fake_get_session,
                ), patch(
                    "routes.segmentation_sync.endpoints.get_owned_study_or_404",
                    return_value=fake_study,
                ):
                    _compensate_unaccepted_revision(
                        study_id,
                        current_user=SimpleNamespace(sub="42"),
                        mask_disk_path=active_path,
                        previous_active_mask=previous_mask,
                        previous_segmentation_state=snapshot,
                        analysis_cache_existed=True,
                        previous_analysis_cache=original_cache,
                    )

                np.testing.assert_array_equal(
                    np.load(active_path, allow_pickle=False),
                    previous_mask,
                )
                self.assertEqual(original_segmentation.total_ild_volume_ml, 1.0)
                self.assertEqual(original_segmentation.mesh_url, "/old.glb")
                self.assertEqual(original_segmentation.mask_path, "/old.npy")
                self.assertEqual(
                    original_segmentation.zonal_distribution,
                    {"Upper": 100.0},
                )
                self.assertEqual(_analysis_cache[study_id]["mesh_url"], "/old.glb")
                np.testing.assert_array_equal(
                    _analysis_cache[study_id]["mask"],
                    original_cache["mask"],
                )
            finally:
                _analysis_cache.pop(study_id, None)

    def test_acceptance_failure_compensates_before_marking_failed(self) -> None:
        study_id = "ST-accept-failure"
        previous_mask = np.array([[[1]]], dtype=np.uint8)
        new_mask = np.array([[[2]]], dtype=np.uint8)
        segmentation = SimpleNamespace(
            total_ild_volume_ml=1.0,
            ild_fraction=0.1,
            lung_volume_ml=10.0,
            ggo_volume_ml=1.0,
            reticulation_volume_ml=0.0,
            consolidation_volume_ml=0.0,
            ggo_burden=1.0,
            reticulation_burden=0.0,
            consolidation_burden=0.0,
            zonal_distribution={"Upper": 100.0},
            mesh_url="/old.glb",
            stl_url="/old.stl",
            mask_path="/old.npy",
            mask_shape="1,1,1",
            mask_bytes=None,
        )
        fake_study = SimpleNamespace(segmentation=segmentation)
        fake_session = SimpleNamespace(flush=lambda: None)

        @contextmanager
        def fake_get_session():
            yield fake_session

        metrics = {
            "total_ild_volume_ml": 2.0,
            "ild_burden": 0.2,
            "lung_volume_ml": 10.0,
            "ggo_volume_ml": 0.0,
            "reticulation_volume_ml": 2.0,
            "consolidation_volume_ml": 0.0,
            "ggo_burden": 0.0,
            "reticulation_burden": 1.0,
            "consolidation_burden": 0.0,
        }
        accept_mock = Mock(side_effect=RuntimeError("manifest replace failed"))
        fail_mock = Mock()
        publish_mock = AsyncMock()

        with tempfile.TemporaryDirectory() as directory:
            mask_storage = Path(directory)
            active_path = mask_storage / f"{study_id}.npy"
            np.save(active_path, previous_mask)
            prior_cache = {"mesh_url": "/old.glb", "mask": previous_mask.copy()}
            _analysis_cache[study_id] = prior_cache
            try:
                with patch.multiple(
                    sync_endpoints,
                    MASK_STORAGE=mask_storage,
                    begin_revision=Mock(
                        return_value=SimpleNamespace(revision_id=2)
                    ),
                    compute_class_metrics=Mock(return_value=metrics),
                    estimate_zonal_distribution=Mock(return_value={}),
                    generate_mesh_exports=Mock(
                        return_value=SimpleNamespace(
                            glb_url="/failed.glb",
                            stl_url="/failed.stl",
                        )
                    ),
                    get_session=fake_get_session,
                    get_owned_study_or_404=Mock(return_value=fake_study),
                    accept_revision=accept_mock,
                    load_manifest=Mock(
                        return_value={
                            "revisions": [{"revision_id": 2, "status": "pending"}]
                        }
                    ),
                    fail_revision=fail_mock,
                    study_event_hub=SimpleNamespace(publish=publish_mock),
                ):
                    with self.assertRaisesRegex(
                        RuntimeError,
                        "manifest replace failed",
                    ):
                        asyncio.run(
                            _process_revision(
                                study_id,
                                current_user=SimpleNamespace(sub="42"),
                                mask=new_mask,
                                study_volume=SimpleNamespace(
                                    data=np.zeros((1, 1, 1)),
                                    spacing_zyx=(1.0, 1.0, 1.0),
                                ),
                                shape_zyx=(1, 1, 1),
                                spacing_zyx_mm=(1.0, 1.0, 1.0),
                                orientation="zyx",
                                source="slicer",
                                revision_note="test",
                                module_name=None,
                                module_version=None,
                                workstation_id=None,
                            )
                        )

                fail_mock.assert_called_once()
                publish_mock.assert_not_awaited()
                np.testing.assert_array_equal(
                    np.load(active_path, allow_pickle=False),
                    previous_mask,
                )
                self.assertEqual(segmentation.mesh_url, "/old.glb")
                self.assertEqual(segmentation.stl_url, "/old.stl")
                self.assertEqual(segmentation.mask_path, "/old.npy")
                self.assertEqual(segmentation.total_ild_volume_ml, 1.0)
                self.assertEqual(_analysis_cache[study_id]["mesh_url"], "/old.glb")
                np.testing.assert_array_equal(
                    _analysis_cache[study_id]["mask"],
                    previous_mask,
                )
            finally:
                _analysis_cache.pop(study_id, None)


if __name__ == "__main__":
    unittest.main()
