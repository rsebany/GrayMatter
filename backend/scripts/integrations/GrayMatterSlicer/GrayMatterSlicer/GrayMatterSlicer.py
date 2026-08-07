"""User-facing GrayMatter round-trip module for 3D Slicer."""
from __future__ import annotations

import importlib
import os
from pathlib import Path

import ctk
import numpy as np
import qt
import slicer
import vtk
from slicer.ScriptedLoadableModule import (
    ScriptedLoadableModule,
    ScriptedLoadableModuleTest,
    ScriptedLoadableModuleWidget,
)

import GrayMatterSlicerCore as core

# Slicer's developer Reload action reloads this file but normally leaves helper
# modules cached. Reload the core explicitly so UI and helper updates stay aligned.
core = importlib.reload(core)


def _slicer_geometry(manifest):
    """Return geometry in Slicer's numpy KJI order."""
    shape, spacing = core.geometry_from_manifest(manifest)
    if manifest.get("imaging_source") == "nifti":
        return tuple(reversed(shape)), tuple(reversed(spacing))
    return shape, spacing


def _mask_to_slicer_order(mask, manifest):
    """Convert the server's legacy NIfTI XYZ mask to Slicer ZYX."""
    if manifest.get("imaging_source") == "nifti":
        return np.transpose(mask, (2, 1, 0)).copy()
    return mask.copy()


def _mask_from_slicer_order(mask, manifest):
    """Convert a Slicer-edited NIfTI mask back to server order."""
    if manifest.get("imaging_source") == "nifti":
        return np.transpose(mask, (2, 1, 0)).copy()
    return mask.copy()


class GrayMatterSlicer(ScriptedLoadableModule):
    def __init__(self, parent):
        ScriptedLoadableModule.__init__(self, parent)
        self.parent.title = "GrayMatter"
        self.parent.categories = ["Informatics"]
        self.parent.dependencies = []
        self.parent.contributors = ["GrayMatter contributors"]
        self.parent.helpText = (
            "Pull a GrayMatter study, edit left/right hippocampus segments, validate "
            "geometry and labels, then push a revision."
        )
        self.parent.acknowledgementText = "GrayMatter 3D Slicer integration."


class GrayMatterSlicerWidget(ScriptedLoadableModuleWidget):
    LEFT_SEGMENT_ID = "GrayMatter_Left"
    RIGHT_SEGMENT_ID = "GrayMatter_Right"

    def setup(self):
        ScriptedLoadableModuleWidget.setup(self)
        self.manifest = None
        self.referenceVolumeNode = None
        self.segmentationNode = None

        connection = ctk.ctkCollapsibleButton()
        connection.text = "Connection and study"
        self.layout.addWidget(connection)
        connectionLayout = qt.QFormLayout(connection)

        self.apiBaseEdit = qt.QLineEdit("http://localhost/api")
        self.apiBaseEdit.toolTip = "GrayMatter API root, including /api when applicable."
        connectionLayout.addRow("API base:", self.apiBaseEdit)

        self.studyIdEdit = qt.QLineEdit()
        self.studyIdEdit.placeholderText = "ST-abc12345"
        connectionLayout.addRow("Study ID:", self.studyIdEdit)

        self.tokenEdit = qt.QLineEdit()
        self.tokenEdit.echoMode = qt.QLineEdit.Password
        self.tokenEdit.placeholderText = "Session token"
        connectionLayout.addRow("Session token:", self.tokenEdit)

        self.emailEdit = qt.QLineEdit()
        self.emailEdit.placeholderText = "Optional: log in to obtain a token"
        connectionLayout.addRow("Email:", self.emailEdit)

        self.passwordEdit = qt.QLineEdit()
        self.passwordEdit.echoMode = qt.QLineEdit.Password
        connectionLayout.addRow("Password:", self.passwordEdit)

        self.loginButton = qt.QPushButton("Log in")
        self.loginButton.toolTip = (
            "Obtain a session token. A short-lived study-scoped token is obtained "
            "only when pushing."
        )
        connectionLayout.addRow("", self.loginButton)

        credentialRow = qt.QHBoxLayout()
        self.rememberCheck = qt.QCheckBox("Remember me")
        self.rememberCheck.enabled = core.credential_manager_available()
        self.rememberCheck.toolTip = (
            "Store the session token in Windows Credential Manager. "
            "The password is never stored."
        )
        self.forgetButton = qt.QPushButton("Forget saved login")
        self.forgetButton.enabled = core.credential_manager_available()
        credentialRow.addWidget(self.rememberCheck)
        credentialRow.addWidget(self.forgetButton)
        connectionLayout.addRow("", credentialRow)

        self.workspaceEdit = ctk.ctkPathLineEdit()
        self.workspaceEdit.filters = ctk.ctkPathLineEdit.Dirs
        self.workspaceEdit.currentPath = os.path.join(
            qt.QStandardPaths.writableLocation(qt.QStandardPaths.DocumentsLocation),
            "GrayMatterSlicer",
        )
        connectionLayout.addRow("Workspace:", self.workspaceEdit)

        actions = ctk.ctkCollapsibleButton()
        actions.text = "Round-trip actions"
        self.layout.addWidget(actions)
        actionLayout = qt.QVBoxLayout(actions)

        pullRow = qt.QHBoxLayout()
        self.pullLoadButton = qt.QPushButton("Pull and load")
        self.loadButton = qt.QPushButton("Load existing workspace")
        pullRow.addWidget(self.pullLoadButton)
        pullRow.addWidget(self.loadButton)
        actionLayout.addLayout(pullRow)

        self.revisionNoteEdit = qt.QLineEdit("Slicer module edit")
        actionLayout.addWidget(qt.QLabel("Revision note:"))
        actionLayout.addWidget(self.revisionNoteEdit)

        pushRow = qt.QHBoxLayout()
        self.pushButton = qt.QPushButton("Export and push")
        self.statusButton = qt.QPushButton("Get sync status")
        pushRow.addWidget(self.pushButton)
        pushRow.addWidget(self.statusButton)
        actionLayout.addLayout(pushRow)

        state = ctk.ctkCollapsibleButton()
        state.text = "Current state"
        state.collapsed = False
        self.layout.addWidget(state)
        stateLayout = qt.QFormLayout(state)
        self.connectionState = qt.QLabel("Not connected")
        self.studyState = qt.QLabel("No study loaded")
        self.geometryState = qt.QLabel("Not validated")
        self.revisionState = qt.QLabel("Unknown")
        stateLayout.addRow("Connection:", self.connectionState)
        stateLayout.addRow("Study:", self.studyState)
        stateLayout.addRow("Geometry:", self.geometryState)
        stateLayout.addRow("Revision:", self.revisionState)

        labels = qt.QLabel(
            '<span style="color:#e63838">■</span> 1 — Left hippocampus&nbsp;&nbsp;'
            '<span style="color:#3373eb">■</span> 2 — Right hippocampus'
        )
        labels.textFormat = qt.Qt.RichText
        stateLayout.addRow("Labels:", labels)

        self.log = qt.QPlainTextEdit()
        self.log.readOnly = True
        self.log.maximumHeight = 130
        stateLayout.addRow("Activity:", self.log)

        self.loginButton.connect("clicked(bool)", self.onLogin)
        self.forgetButton.connect("clicked(bool)", self.onForgetSavedLogin)
        self.pullLoadButton.connect("clicked(bool)", self.onPullAndLoad)
        self.loadButton.connect("clicked(bool)", self.onLoadWorkspace)
        self.pushButton.connect("clicked(bool)", self.onExportAndPush)
        self.statusButton.connect("clicked(bool)", self.onStatus)
        self.layout.addStretch(1)
        self._setActionsEnabled(True)
        self._restoreSavedLogin()

    def cleanup(self):
        # Explicitly release credentials when the module widget is destroyed.
        self.tokenEdit.clear()
        self.passwordEdit.clear()

    def _apiBase(self):
        return core.normalize_api_base(self.apiBaseEdit.text)

    def _studyId(self):
        study_id = self.studyIdEdit.text.strip()
        if not study_id:
            raise ValueError("Study ID is required.")
        return study_id

    def _token(self):
        token = self.tokenEdit.text.strip()
        if not token:
            raise ValueError("Enter a bearer token or use Log in.")
        return token

    def _workspace(self):
        path = self.workspaceEdit.currentPath.strip()
        if not path:
            raise ValueError("Workspace path is required.")
        return Path(path)

    def _setActionsEnabled(self, enabled):
        for button in (
            self.loginButton,
            self.pullLoadButton,
            self.loadButton,
            self.pushButton,
            self.statusButton,
        ):
            button.enabled = enabled
        slicer.app.processEvents()

    def _run(self, description, operation):
        self._setActionsEnabled(False)
        self.log.appendPlainText(description + "…")
        try:
            result = operation()
            self.log.appendPlainText(description + " complete.")
            return result
        except Exception as exc:
            self.log.appendPlainText("ERROR: " + str(exc))
            slicer.util.errorDisplay(str(exc), windowTitle="GrayMatter")
            return None
        finally:
            self._setActionsEnabled(True)

    def onLogin(self):
        def operation():
            token, user = core.login(
                self._apiBase(), self.emailEdit.text, self.passwordEdit.text
            )
            self.tokenEdit.text = token
            self.passwordEdit.clear()
            identity = user.get("email") or user.get("full_name") or "authenticated user"
            savedEmail = user.get("email") or self.emailEdit.text.strip()
            self.connectionState.text = "Connected as " + str(identity)
            if self.rememberCheck.checked:
                core.save_session_credential(
                    self._apiBase(),
                    str(savedEmail),
                    token,
                )
                self.log.appendPlainText("Session saved in Windows Credential Manager.")
            elif core.credential_manager_available():
                core.delete_session_credential()
            return token

        self._run("Logging in", operation)

    def _restoreSavedLogin(self):
        if not core.credential_manager_available():
            return
        try:
            saved = core.load_session_credential()
        except Exception as exc:
            self.log.appendPlainText("Could not load saved login: " + str(exc))
            return
        if not saved:
            return
        self.apiBaseEdit.text = saved["api_base"]
        self.emailEdit.text = saved["email"]
        self.tokenEdit.text = saved["token"]
        self.rememberCheck.checked = True
        identity = saved["email"] or "saved user"
        self.connectionState.text = "Saved session loaded for " + identity
        self.log.appendPlainText("Loaded session from Windows Credential Manager.")

    def onForgetSavedLogin(self):
        def operation():
            core.delete_session_credential()
            self.tokenEdit.clear()
            self.passwordEdit.clear()
            self.rememberCheck.checked = False
            self.connectionState.text = "Saved login removed"

        self._run("Removing saved login", operation)

    def onPullAndLoad(self):
        def operation():
            workspace = self._workspace() / self._studyId()
            manifest = core.pull_workspace(
                self._apiBase(), self._studyId(), self._token(), workspace
            )
            self.workspaceEdit.currentPath = str(workspace)
            self._loadManifest(manifest)
            self.connectionState.text = "Connected"
            self._refreshStatus()
            return manifest

        self._run("Pulling and loading study", operation)

    def onLoadWorkspace(self):
        def operation():
            manifest = core.load_workspace_manifest(self._workspace())
            self.studyIdEdit.text = str(manifest["study_id"])
            if manifest.get("api_base"):
                self.apiBaseEdit.text = str(manifest["api_base"])
            self._loadManifest(manifest)
            return manifest

        self._run("Loading workspace", operation)

    def _loadManifest(self, manifest):
        reference = self._loadReferenceVolume(manifest)
        serverShape, serverSpacing = core.geometry_from_manifest(manifest)
        shape, spacing = _slicer_geometry(manifest)
        actualShape = tuple(reversed(reference.GetImageData().GetDimensions()))
        actualSpacing = tuple(reversed(reference.GetSpacing()))
        probe = np.zeros(actualShape, dtype=np.uint8)
        core.validate_geometry(probe, shape, spacing, actualSpacing)

        serverMask = np.load(str(manifest["mask_path"])).astype(np.uint8)
        core.validate_allowed_labels(serverMask)
        core.validate_geometry(
            serverMask,
            serverShape,
            serverSpacing,
            serverSpacing,
        )
        mask = _mask_to_slicer_order(serverMask, manifest)
        core.validate_geometry(mask, shape, spacing, actualSpacing)
        segmentation = self._createSegmentation(mask, reference, manifest["study_id"])

        self.manifest = manifest
        self.referenceVolumeNode = reference
        self.segmentationNode = segmentation
        self.studyState.text = "{} loaded".format(manifest["study_id"])
        self.geometryState.text = "Valid — shape {}, spacing {} mm".format(shape, spacing)
        slicer.util.setSliceViewerLayers(background=reference, fit=True)
        slicer.util.selectModule("SegmentEditor")

    def _loadReferenceVolume(self, manifest):
        source = manifest.get("imaging_source")
        if source == "nifti":
            path = str(manifest.get("nifti_path") or "")
            if not Path(path).is_file():
                raise FileNotFoundError("NIfTI volume not found: " + path)
            node = slicer.util.loadVolume(path)
            if node is None:
                raise RuntimeError("Slicer could not load the NIfTI volume.")
            return node
        if source != "dicom":
            raise RuntimeError(
                "Workspace has no loadable imaging source. " + str(manifest.get("imaging_note", ""))
            )

        from DICOMLib import DICOMUtils

        dicom_dir = str(manifest["dicom_dir"])
        with DICOMUtils.TemporaryDICOMDatabase() as database:
            DICOMUtils.importDicom(dicom_dir, database)
            patients = database.patients()
            if not patients:
                raise RuntimeError("No DICOM patient was imported from the workspace.")
            loaded_ids = DICOMUtils.loadPatientByUID(patients[0])
        for node_id in loaded_ids or []:
            node = slicer.mrmlScene.GetNodeByID(node_id)
            if node and node.IsA("vtkMRMLScalarVolumeNode"):
                return node
        raise RuntimeError("DICOM import did not produce a scalar volume.")

    def _createSegmentation(self, mask, reference, study_id):
        node = slicer.mrmlScene.AddNewNodeByClass(
            "vtkMRMLSegmentationNode", "GrayMatter-{}".format(study_id)
        )
        node.SetReferenceImageGeometryParameterFromVolumeNode(reference)
        node.SetNodeReferenceID(
            slicer.vtkMRMLSegmentationNode.GetReferenceImageGeometryReferenceRole(),
            reference.GetID(),
        )
        segmentation = node.GetSegmentation()
        for label, segment_id in (
            (1, self.LEFT_SEGMENT_ID),
            (2, self.RIGHT_SEGMENT_ID),
        ):
            color = core.LABEL_COLORS[label]
            segmentation.AddEmptySegment(
                segment_id, core.LABEL_NAMES[label], vtk.vtkVector3d(*color)
            )
            slicer.util.updateSegmentBinaryLabelmapFromArray(
                (mask == label).astype(np.uint8), node, segment_id, reference
            )
        node.CreateClosedSurfaceRepresentation()
        return node

    def _exportMask(self):
        if self.manifest is None or self.segmentationNode is None:
            raise RuntimeError("Pull or load a study before exporting.")
        reference = self.referenceVolumeNode
        segmentation = self.segmentationNode.GetSegmentation()
        allowed_ids = {self.LEFT_SEGMENT_ID, self.RIGHT_SEGMENT_ID}
        present_ids = {
            segmentation.GetNthSegmentID(index)
            for index in range(segmentation.GetNumberOfSegments())
        }
        unexpected = sorted(present_ids - allowed_ids)
        if unexpected:
            raise ValueError(
                "Segmentation contains unsupported segments: {}. "
                "Only left and right hippocampus may be pushed.".format(unexpected)
            )

        serverShape, serverSpacing = core.geometry_from_manifest(self.manifest)
        shape, expectedSpacing = _slicer_geometry(self.manifest)
        actualSpacing = tuple(reversed(reference.GetSpacing()))
        out = np.zeros(shape, dtype=np.uint8)
        occupied = np.zeros(shape, dtype=bool)
        for label, segment_id in (
            (1, self.LEFT_SEGMENT_ID),
            (2, self.RIGHT_SEGMENT_ID),
        ):
            if not segmentation.GetSegment(segment_id):
                raise ValueError("Required segment is missing: " + core.LABEL_NAMES[label])
            array = slicer.util.arrayFromSegmentBinaryLabelmap(
                self.segmentationNode, segment_id, reference
            )
            if array is None or tuple(array.shape) != shape:
                raise ValueError(
                    "{} segment geometry does not match the study.".format(
                        core.LABEL_NAMES[label]
                    )
                )
            selected = array > 0
            if np.any(occupied & selected):
                raise ValueError("Left and right hippocampus segments overlap.")
            out[selected] = label
            occupied |= selected

        core.validate_allowed_labels(out)
        core.validate_geometry(out, shape, expectedSpacing, actualSpacing)
        serverMask = _mask_from_slicer_order(out, self.manifest)
        core.validate_geometry(
            serverMask,
            serverShape,
            serverSpacing,
            serverSpacing,
        )
        self.geometryState.text = "Valid for push — shape {}, spacing {} mm".format(
            serverShape, serverSpacing
        )
        return serverMask, serverSpacing

    def onExportAndPush(self):
        def operation():
            mask, spacing = self._exportMask()
            export_path = self._workspace() / "edited_mask.npy"
            np.save(str(export_path), mask)
            result = core.push_revision(
                self._apiBase(),
                self._studyId(),
                self._token(),
                mask,
                spacing,
                self.revisionNoteEdit.text,
            )
            revision = result.get("revision_id", "unknown")
            self.revisionState.text = "Pushed revision {}".format(revision)
            self.log.appendPlainText("Exported validated mask to " + str(export_path))
            return result

        self._run("Exporting and pushing revision", operation)

    def _refreshStatus(self):
        status = core.get_sync_status(self._apiBase(), self._studyId(), self._token())
        self.connectionState.text = "Connected"
        current = status.get("current_revision_id", 0)
        latest = status.get("latest") or {}
        source = latest.get("source")
        created = latest.get("created_at")
        detail = "Revision {}".format(current)
        if source:
            detail += " from " + str(source)
        if created:
            detail += " at " + str(created)
        self.revisionState.text = detail
        return status

    def onStatus(self):
        self._run("Fetching sync status", self._refreshStatus)


class GrayMatterSlicerTest(ScriptedLoadableModuleTest):
    def runTest(self):
        self.setUp()
        self.test_GrayMatterSlicerCore()

    def setUp(self):
        slicer.mrmlScene.Clear()

    def test_GrayMatterSlicerCore(self):
        self.delayDisplay("Testing GrayMatter validation helpers")
        mask = np.zeros((2, 3, 4), dtype=np.uint8)
        mask[0, 0, 0] = 1
        mask[1, 2, 3] = 2
        self.assertEqual(core.validate_allowed_labels(mask), (0, 1, 2))
        core.validate_geometry(mask, (2, 3, 4), (1.5, 0.8, 0.8), (1.5, 0.8, 0.8))
        payload = core.build_revision_payload(mask, (1.5, 0.8, 0.8), "test")
        self.assertEqual(payload["labels"], core.LABELS)
        self.assertNotIn("token", payload)
        self.delayDisplay("GrayMatter core tests passed")
