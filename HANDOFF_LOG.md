# Handoff journal — The Nexus
<!-- Append-only. Never edit or delete entries; correct with a new `correction` entry.
     Header: ### <iso-time> · <agent> · <kind> · <head> <clean|dirty N>. Use handoff.py log. -->

### 2026-11-14T17:40-04:00 · claude · claim · b7f6c31 (restore/native-overlay) clean
- task: Restore native overlay feature; handoff/docs committed
- lease until 2026-11-14T19:40-04:00

### 2026-11-14T17:41-04:00 · claude · checkpoint · b7f6c31 (restore/native-overlay) clean
- verified: npm run check && npm test (96/97)
- Restored native overlay feature after loss: recreated native/overlay C++ source (bridge/renderer/shared/test-game, CMakeLists, THIRD_PARTY) from session context with hardening intact; re-vendored MinHook at pinned 8af6b4ac; rebuilt NexusOverlay.dll (builds clean). JS integration had survived (committed). Committed on branch restore/native-overlay in staged commits.
- Verified: npm run check PASS; npm test 96/97 (1 POSIX skip). DLL gitignored (reproducible). Docs restored and brought current with the Completed/no-detection Defender determination.
- next: Decide merge of restore/native-overlay; rerun isolated fixtures before any live-game test

### 2026-11-14T17:41-04:00 · claude · handoff · a683d91 (restore/native-overlay) dirty 1
- Native overlay feature restored and committed on restore/native-overlay (5 commits). Builds clean, 96/97 tests, DLL in place, docs+handoff committed. Branch local only, not pushed.
- next: User decides merge into feature/updates-and-trailers/main; rerun isolated fixtures before any live-game test.

### 2026-11-14T17:48-04:00 · claude · claim · be24928 (feature/updates-and-trailers) dirty 1
- task: Record native overlay isolated validation pass
- lease until 2026-11-14T18:48-04:00

### 2026-11-14T17:49-04:00 · claude · verify · be24928 (feature/updates-and-trailers) dirty 2
- verified: smoke-native-overlay.cjs: gpuReadback/inputCaptured/inputReleased/stopPassThrough/reconnect all true; smoke-native-ui.cjs: offscreen friends UI renders in D3D12, Same game/Playing filters, desktop hidden. Both exit 0 on current source, Defender did not interfere.

### 2026-11-14T17:49-04:00 · claude · handoff · be24928 (feature/updates-and-trailers) dirty 2
- Native overlay merged into feature/updates-and-trailers and isolated-validated on current source (both smoke fixtures pass). Remaining coverage (resize/DX11/fullscreen/IME/gamepad) needs harness expansion or approved live test.
- next: Optional: expand fixture coverage or request approved live-game test (anti-cheat first).

### 2026-11-14T18:32-04:00 · claude · checkpoint · f22aa3a (feature/updates-and-trailers) dirty 1
- verified: npm run check + npm test (96/97); desktopPreferences nativeOverlay contract
- Made native overlay a user opt-in: nativeOverlay desktop pref + Settings 'Use in-game overlay (beta)' toggle (shown when DLL available), startup gate honors env OR pref AND DLL-present, DLL packaged via extraResources. Off by default, restart to apply. check PASS, 96/97 tests. Commit f22aa3a. Preference contract verified by node check.
- next: Live-game test on user-chosen non-anti-cheat game; warn about bans first

### 2026-11-14T18:50-04:00 · claude · checkpoint · 9bc04ad (feature/updates-and-trailers) dirty 2
- verified: npm run check + npm test (101/102)
- Added anti-cheat guard (lib/anti-cheat.js): refuses native injection into anti-cheat games (file markers + process scan), before create/attach. 5 unit tests, 101/102 pass, check green. Documented future Nexus-owned OS-layer overlay (not a Game Bar widget) in GAME-OVERLAY-ARCHITECTURE.md.
- next: Live test on a non-anti-cheat game the user picks

### 2026-11-16T14:55-04:00 · claude · claim · 97a1e64 (main) dirty 1
- task: Xbox/Epic session renewal via ChainLens refresh endpoint
- lease until 2026-11-16T17:55-04:00

### 2026-11-16T15:01-04:00 · claude · handoff · 97a1e64 (fix/xbox-epic-session-renewal) dirty 6
- Branch fix/xbox-epic-session-renewal (uncommitted): AccountSocial keeps refreshToken, renews on restore/before expiry/after transient failure via ChainLens renewIdentitySession; revoked grant clears account. chainlens-client errors carry status+reconnect. npm run check + npm test 113 pass/1 skip; app launch clean.
- next: With user approval: commit, push, PR; ship after ChainLens renewal endpoint is deployed.
