# True in-game overlay architecture decision

Status: user selected an independent Nexus overlay. Source prototype implemented and committed under native/overlay/. No Game Bar or Steam overlay host is used. The shipped overlay is also available as a floating Electron BrowserWindow, which calls show/focus and therefore changes desktop foreground ownership. Do not describe that floating window as equivalent to Steam or Xbox Game Bar.

## Option A: Xbox Game Bar widget

Create a separate UWP XAML companion with the Microsoft Xbox Game Bar SDK. Game Bar renders its view in the system overlay space. Communicate with Nexus through a narrowly scoped local authenticated bridge; reuse friends, current-game matching and chat services without giving the widget provider tokens. The widget must present Nexus UI, not remote arbitrary content. Game Bar manages activation and pinned widget behavior.

This needs a companion MSIX/AppX install in addition to the portable launcher and Game Bar installed/enabled. The UWP component requirement is not installed in the inspected build tools. Xbox title-identity/invite service permission is a separate concern from making a Game Bar widget.

## Option B: Independent game-rendering overlay (selected)

Render the UI offscreen and provide frames to a native renderer attached to the selected game's graphics presentation pipeline. Alt+C changes input routing inside the game rather than raising the desktop launcher window. Keep the launcher hidden and keep provider tokens/services in the desktop process. Capture keyboard/mouse only while interactive overlay mode is open and reliably release input on dismiss/disconnect/crash.

This requires native graphics hooks, per-renderer validation (especially Dragonwilds DX12), controlled opt-in game attachment, review of dependency source/license, versioned native builds and game/anti-cheat compatibility checks. Do not circumvent protected processes or anti-cheat restrictions, disable protections, or promise universal game support.

## Implementation

The Nexus-owned C++ bridge uses D3D11-on-12 on the game command queue and composites the existing sandboxed offscreen Electron friends UI. A private user-scoped shared mapping transports pixels and input, with a heartbeat timeout to release input. Host attachment rechecks the executable path for the selected installed game PID. Rendering does not call show/focus on a desktop overlay window. The only third-party native dependency is vendored MinHook with its redistribution notice.

Earlier isolated tests passed actual D3D12 GPU readback, input routing/release and stop pass-through. The full offscreen Nexus UI rendered inside the synthetic D3D12 fixture with Playing and Same game filters, while its BrowserWindow remained hidden. Evidence: output/native-overlay/graphics-result.json and friends-ui.png. Those tests used a spawned NexusOverlayTest.exe, not a real user game, and predate later source edits; they do not validate the current source.

The independent native path remains behind the development-only NEXUS_NATIVE_OVERLAY switch and is not packaged or enabled by default. No native DLL is copied to the launcher resource folder for release. A signed/reviewed native build and resolution of any security classification are prerequisites for further native tests and distribution.

## Anti-cheat safety (implemented) and the future OS-layer path

Injection-based overlays (ours, Steam, Discord) look identical to cheats at the behavioral
level: foreign DLL loaded into the game process, graphics and input hooked. Anti-cheat
engines flag that pattern regardless of intent. Steam/Discord are tolerated because they
are signed, recognized, and explicitly allow-listed by anti-cheat vendors; Xbox Game Bar
avoids the problem entirely by drawing in the OS compositor and never entering the game
process.

- Implemented now (lib/anti-cheat.js): before attaching, Nexus detects known anti-cheat
  (EasyAntiCheat, BattlEye, Vanguard, PunkBuster, GameGuard, XignCode, nProtect, mhyprot)
  by marker files beside the game and by running processes, and REFUSES to inject into a
  protected game. The injection overlay is therefore used only on non-anti-cheat games.
- Future direction (user-chosen): a Nexus-OWNED independent OS-layer overlay that renders
  on top without injecting into the game — Nexus's own entity, explicitly NOT an Xbox Game
  Bar widget and not hosted by Game Bar. This is the safe path for anti-cheat games and a
  larger, separate implementation (a Nexus compositor/overlay surface), to be built after
  the injection overlay is solid on non-protected games.

## Sources reviewed

- https://learn.microsoft.com/en-us/gaming/game-bar/overview
- https://github.com/microsoft/XboxGameBarSamples
- https://github.com/hamstu/electron-game-overlay (inspected as a candidate only; not incorporated)
