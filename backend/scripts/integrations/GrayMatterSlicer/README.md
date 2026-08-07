# GrayMatter 3D Slicer extension

This is a standard scripted Slicer extension containing the **GrayMatter**
module. It wraps the existing GrayMatter API without changing the
`slicer_connect.py` or `slicer_bridge.py` command-line interfaces.

## Install in 3D Slicer

1. Install 3D Slicer 5.x.
2. Enable **Edit > Application Settings > Developer > Developer mode**.
3. Under **Application Settings > Modules > Additional module paths**, add the
   inner module directory:

   ```text
   <GrayMatter>\backend\scripts\integrations\GrayMatterSlicer\GrayMatterSlicer
   ```

4. Restart Slicer and open **Modules > Informatics > GrayMatter**.
5. For development changes, use the module's **Reload** button. The module also
   reloads its core helper to prevent stale-code errors.

## Use the module

1. Enter `http://localhost/api`, a completed `ST-...` study ID, and the same
   GrayMatter account used in the browser.
2. Optionally select **Remember me** before login. Windows Credential Manager
   stores the session token, never the password.
3. Select a separate base workspace such as
   `C:\Users\<you>\Desktop\GrayMatterSlicerData`. Do not select this source
   directory or add the study ID to the path.
4. Click **Pull and load**, edit the red left and blue right hippocampus
   segments, add a revision note, and click **Export and push**.

After a successful push, GrayMatter stores a new immutable revision, activates
the corrected mask, recalculates metrics, regenerates GLB/STL meshes, and sends
live events. An open View 3D page displays a success toast and refreshes the
mesh, metrics, sync status, and revision history. The toast is not a persistent
notification-center record.

The module supports:

- session-token entry or email/password login, with optional Windows Credential
  Manager persistence;
- study pull plus DICOM/NIfTI and segmentation loading;
- loading an existing workspace;
- left (red, label 1) and right (blue, label 2) hippocampus editing;
- geometry, overlap, segment, and allowed-label validation before push;
- validated `.npy` export and revision push; and
- current connection, study, geometry, and server revision status.

Passwords are always held only by the live module widget. When **Remember me**
is selected on Windows, the normal session token is stored as a generic Windows
Credential Manager credential and restored when the module opens. **Forget
saved login** removes it. For each push the module obtains a short-lived
`segmentation:write` token scoped to the loaded study, uses it for that request,
and discards it. No token is written to the workspace manifest or project files.

## Pure-Python self-check

From this extension directory:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

The UI also exposes the standard Slicer scripted-module test
`GrayMatterSlicerTest`.
