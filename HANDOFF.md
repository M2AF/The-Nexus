# Handoff board — The Nexus
<!-- handoff v1. LIVE STATE ONLY: rewrite in place, keep under ~60 lines.
     History goes in HANDOFF_LOG.md. Machine fields above the first ## are managed by handoff.py. -->

owner: claude
task: Restore native overlay feature; handoff/docs committed
lease_until: 2026-11-14T20:41-04:00
repo: .
verify: npm run check && npm test
verified: b7f6c31 · npm run check && npm test (96/97) · 2026-11-14T17:41-04:00
head: b7f6c31 (restore/native-overlay) clean
updated: 2026-11-14T17:41-04:00 · claude

resources: -

## Now
- Native overlay feature RESTORED on branch restore/native-overlay (off feature/updates-and-trailers). native/overlay C++ source + vendored MinHook re-committed; builds clean (MSVC 14.44/CMake VS2022 x64); npm run check passes, 96/97 tests (1 POSIX skip).
- Only the C++ source/handoff/docs were ever lost (untracked); the committed JS integration (lib/native-overlay.js, app/native-overlay.js, main.js) survived with unchanged ABI.
- Defender developer submission 7b572675-2a89-4691-a520-6d4cbad5f22b COMPLETED: no detection on NexusOverlay.dll. Nuance: submitted DLL != the originally-blocked test .exe.
- Native path is dev-only (NEXUS_NATIVE_OVERLAY=1), not packaged/enabled; not runtime-validated on current source; no live game attached.

## Next
- Decide merge of restore/native-overlay; rerun isolated fixtures before any live-game test

## Traps
- COMMIT WIP even half-finished: the whole native/overlay source was lost on 2026-11-14 because it was left untracked and another agent's branch/clean removed it. Never leave feature work untracked.
- Rebuilt NexusOverlay.dll is NOT byte-identical across builds (MSVC embeds timestamp/PDB GUID); source is the source of truth. DLL is gitignored at native/overlay/NexusOverlay.dll.
- Never execute the DLL outside an approved test, restore quarantine, add exclusions, or disable protection. Do not change injection method solely to dodge detection.
- Earlier output/native-overlay/graphics-result.json predates current source; not validation.

## Skills
- agent-handoff: board/journal/lease. Claude: C:/Users/balla/.claude/skills/agent-handoff/SKILL.md.
- fullstack-iteration / debugging: native build + JS integration restore and verification.

## Pointers
- Source: native/overlay/{bridge,renderer,test-game}.cpp, shared.h, CMakeLists.txt, vendor/minhook; integration in main.js (~L309), lib/native-overlay.js, app/native-overlay.js.
- Docs: docs/NATIVE-OVERLAY-DEFENDER-SUBMISSION.md, NATIVE-OVERLAY-SECURITY-REVIEW.md, GAME-OVERLAY-ARCHITECTURE.md, OVERLAY.md.
- Evidence: output/native-overlay/{submission-state.json,security-review.json,graphics-result.json,friends-ui.png}. Build: cmake -S native/overlay -B output/native-overlay-build -G "Visual Studio 17 2022" -A x64 && cmake --build ... --target NexusOverlay --config Release.
