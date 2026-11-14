# Handoff board — The Nexus
<!-- handoff v1. LIVE STATE ONLY: rewrite in place, keep under ~60 lines.
     History goes in HANDOFF_LOG.md. Machine fields above the first ## are managed by handoff.py. -->

owner: none
task: -
lease_until: -
repo: .
verify: npm run check && npm test
verified: f22aa3a · npm run check + npm test (96/97); desktopPreferences nativeOverlay contract · 2026-11-14T18:32-04:00
head: f22aa3a (feature/updates-and-trailers) dirty 1
updated: 2026-11-14T18:32-04:00 · claude

resources: -

## Now
- Native overlay feature RESTORED and MERGED into feature/updates-and-trailers (ff from restore/native-overlay). Builds clean; npm run check passes, 96/97 tests (1 POSIX skip).
- ISOLATED VALIDATION PASSES on current source (2026-11-14): scripts/smoke-native-overlay.cjs -> {gpuReadback,inputCaptured,inputReleased,stopPassThrough,reconnect}=true; scripts/smoke-native-ui.cjs -> offscreen friends UI renders in D3D12, Same game/Playing filters work, desktop window stays hidden. Defender did not interfere this run.
- Defender developer submission 7b572675-... COMPLETED: no detection on NexusOverlay.dll (nuance: that DLL != the originally-blocked test .exe).
- Native overlay is now a USER OPT-IN: 'nativeOverlay' desktop pref + Settings toggle "Use in-game overlay (beta)" (shown when DLL available); startup honors env OR pref AND DLL present; DLL packaged via extraResources (native/overlay/NexusOverlay.dll -> overlay/). Off by default; restart to apply. Commit f22aa3a.
- Still NO real game attached. Injecting into an anti-cheat-protected game can get the user BANNED; live test must be on a user-chosen non-anti-cheat game.

## Next
- Live-game test on user-chosen non-anti-cheat game; warn about bans first

## Traps
- COMMIT WIP even half-finished: the whole native/overlay source was lost on 2026-11-14 because it was left untracked and another agent's branch/clean removed it. Never leave feature work untracked.
- Rebuilt NexusOverlay.dll is NOT byte-identical across builds (MSVC embeds timestamp/PDB GUID); source is the source of truth. DLL is gitignored at native/overlay/NexusOverlay.dll.
- Never execute the DLL outside an approved test, restore quarantine, add exclusions, or disable protection. Do not change injection method solely to dodge detection.
- output/native-overlay/graphics-result.json + friends-ui.png regenerated 2026-11-14 and DO reflect current source (isolated pass). output/ is gitignored, so evidence is reproducible via the two smoke scripts, not committed.

## Skills
- agent-handoff: board/journal/lease. Claude: C:/Users/balla/.claude/skills/agent-handoff/SKILL.md.
- fullstack-iteration / debugging: native build + JS integration restore and verification.

## Pointers
- Source: native/overlay/{bridge,renderer,test-game}.cpp, shared.h, CMakeLists.txt, vendor/minhook; integration in main.js (~L309), lib/native-overlay.js, app/native-overlay.js.
- Docs: docs/NATIVE-OVERLAY-DEFENDER-SUBMISSION.md, NATIVE-OVERLAY-SECURITY-REVIEW.md, GAME-OVERLAY-ARCHITECTURE.md, OVERLAY.md.
- Evidence: output/native-overlay/{submission-state.json,security-review.json,graphics-result.json,friends-ui.png}. Build: cmake -S native/overlay -B output/native-overlay-build -G "Visual Studio 17 2022" -A x64 && cmake --build ... --target NexusOverlay --config Release.
