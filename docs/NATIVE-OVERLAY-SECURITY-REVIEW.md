# Native overlay security review

> Status (2026-11-14): source reviewed; Defender developer submission for the built DLL
> was Completed with "no positive detection" (see NATIVE-OVERLAY-DEFENDER-SUBMISSION.md).
> The native path remains development-only, unsigned, and not runtime-validated on the
> current source. Keep the review items below as the gate before any live-game test.

The user selected an independent Nexus overlay, with no Xbox Game Bar or Steam overlay host. The prototype compiles with MSVC and uses the Nexus-owned DirectX bridge plus vendored MinHook.

Earlier isolated tests passed actual DirectX 12 GPU readback, routed input/release and stop pass-through. The Nexus friends UI also rendered offscreen into the test game with no visible/focused desktop overlay window. These were synthetic accounts and a spawned NexusOverlayTest.exe, not a user game.

Microsoft Defender classified the test executable (NexusOverlayTest.exe) as Behavior:Win32/DefenseEvasion.A!ml and blocked execution. This is a behavioral ML verdict on genuine remote-thread injection plus API hooking, not a presumed false positive. Do not treat output/native-overlay/graphics-result.json as proof of the newest source revision.

No security exclusions, protection disabling, quarantine restoration, alternate injection bypass, or real-game attachment is performed. Native attachment remains behind a development-only switch; no native-enabled package is produced.

## Review scope before resuming

- Review bridge.cpp process-path checks, private shared mapping ACL, remote module load, input hooks and heartbeat fail-open behavior. Do not assume a false positive merely because this is our code.
- Review reconnection/host-loss handling, input release, resizing and game-process exit on the current source.
- Resolve any security classification through a legitimate review/signing/vendor process. Do not weaken the user's protection settings to continue testing. No sample is uploaded without user authorization.
- Rerun the isolated GPU/UI tests before any explicit real-game test. DirectX 11, exclusive fullscreen, IME and gamepad capture are not validated by the D3D12 keyboard/mouse fixture. Vulkan/OpenGL are not implemented.

## Source review findings (verified by scan)

A grep of native/overlay/*.{cpp,h} and lib/native-overlay.js finds NO network (WinHTTP/WinINet/WinSock/http/fetch/child_process), NO persistence (registry Run/service/task/copy), NO credential access (Cred/LSA/CryptUnprotect), and NO screen capture or global keylogging (BitBlt/SetWindowsHookEx/clipboard). The cross-process injection is confined to NO_Attach, which writes a DLL path and loads the on-disk module via LoadLibraryW after validating the target by full image path and PID (x64-only). Exports are exactly the documented control API: NO_Create, NO_Attach, NO_Frame, NO_Heartbeat, NO_Status, NO_Active, NO_Input, NO_Stop.

## Evidence

- output/native-overlay/friends-ui.png
- output/native-overlay/graphics-result.json (earlier successful revision)
- output/native-overlay/security-review.json (source hashes and block state)
- output/native-overlay/submission-state.json (Defender submission record and determination)
