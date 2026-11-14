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

## Sources reviewed

- https://learn.microsoft.com/en-us/gaming/game-bar/overview
- https://github.com/microsoft/XboxGameBarSamples
- https://github.com/hamstu/electron-game-overlay (inspected as a candidate only; not incorporated)
