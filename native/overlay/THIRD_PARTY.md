# Native overlay dependency provenance

The Nexus owns bridge.cpp, renderer.cpp, shared.h and test-game.cpp.

The vendored MinHook source is from https://github.com/TsudaKageyu/minhook at commit `8af6b4acae5a9388fd742b56fa79ece89d96f823`. Its full redistribution notice is retained in vendor/minhook/LICENSE.txt and must accompany any future binary distribution.

No GOverlay or hamstu overlay implementation is incorporated. Those repositories were inspected as architecture candidates only. The current native build is not distributed; Windows Defender blocked the test executable during repeated isolated tests. Do not add exclusions, disable protection, replace the injection mechanism to bypass that block, or claim real-game compatibility from the earlier fixture passes.
