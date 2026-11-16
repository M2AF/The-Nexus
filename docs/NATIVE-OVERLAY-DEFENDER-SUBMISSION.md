# Native overlay: Defender submission and outcome

Record of resolving the Microsoft Defender behavioral detection on the native overlay,
and the ground rules for any further native work. No protections were ever weakened: no
exclusions, no quarantine restore, no repack-to-evade, no injection change to dodge a verdict.

## Problem

Windows Defender classified `NexusOverlayTest.exe` as `Behavior:Win32/DefenseEvasion.A!ml`
(Operational event 1116, 2026-11-11) and removed it. This is a behavioral ML verdict, not
a signature match. The overlay genuinely performs the clustered behaviors: cross-process
DLL load in `NO_Attach` (OpenProcess + VirtualAllocEx + WriteProcessMemory +
CreateRemoteThread → LoadLibraryW) and in-process API hooking via vendored MinHook. These
are legitimate for an opt-in, developer-owned, user-consented overlay, but they are what
the model flags. Treat the detection as expected behavior to resolve legitimately, not to hide.

## Signing (deferred, separate release decision)

Signing is NOT the fix for a behavioral detection and is not on the critical path.
Correction to an earlier draft: per Microsoft's SmartScreen documentation
(https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation), EV
code-signing certificates no longer grant positive SmartScreen reputation by default, so
EV vs OV is a procurement decision, not a SmartScreen one. Certificate purchase is deferred.
When taken up later: HSM/cloud signing (e.g. Azure Trusted Signing), RFC-3161 timestamp,
sign `NexusOverlay.dll` and the packaged launcher.

## Developer submission (the primary path, completed)

Channel: Microsoft Defender developer submission
(https://learn.microsoft.com/defender-xdr/submission-guide). The narrative described the
DLL honestly as developer-owned, user-opt-in, dev-gated overlay software performing no
network/persistence/credential/screen-capture/keylogging, and requested re-evaluation.

- Submission ID: **7b572675-2a89-4691-a520-6d4cbad5f22b**
- Submitted: 2026-11-11, opinion "Incorrect detection", by the project owner's MS account.
- File submitted: `NexusOverlay.dll`, SHA-256
  `f6b2c632269fab3c4d1cbbbed1e1e5a542834e7bb9a43acbeefc448070b0d37e` (169472 bytes).
- Determination (checked 2026-11-14): **Completed.** Analyst note: scanners show no positive
  detection and no telemetry indicators for the DLL; closed with no further action.

### Important nuance

The submitted file was `NexusOverlay.dll` (the overlay module) — which Defender never
quarantined locally — NOT `NexusOverlayTest.exe`, the file that originally produced the
`DefenseEvasion` verdict. So "no detection on the DLL" is a clean result for the DLL but
does not by itself overturn the behavioral verdict on the test harness. To pursue that,
Microsoft asks for Defender diagnostic data (`mpcmdrun.exe -GetFiles` → `MPSupportFiles.cab`)
from the machine that reported the detection, referenced to the submission ID via
https://aka.ms/wdsi.

## Ground rules for further native work

- Never execute the DLL outside an explicitly approved test, restore quarantine, add
  exclusions, or disable protection.
- Do not change the injection method solely to avoid detection; only for an independent
  engineering reason (reliability, anti-cheat cooperation), with the user's decision.
- The DLL is reproducible from native/overlay source (MSVC + CMake); rebuilds are not
  byte-identical (embedded build timestamp/PDB GUID), which is expected.
- Before any live-game test: rerun the isolated graphics/UI fixtures on current source and
  clear the open robustness items (resize/present lock-ordering, Alt+C present-cadence
  coupling, unvalidated DX11/exclusive-fullscreen/IME/gamepad paths). A real-game test is a
  separate, explicitly approved step with anti-cheat compatibility checked first.
