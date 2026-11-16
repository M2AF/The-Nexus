# Nexus overlay and local Steam integration

Current build: 0.9.0. Alt+C opens the existing friends UI as a topmost floating window; Alt+C or close hides it and returns to the game. Full Nexus restores the original window bounds. Main-window close hides to tray when enabled; Quit exits and unregisters the shortcut. No process injection or exclusive-fullscreen compatibility is claimed.

`DesktopLifecycle` owns window/tray/shortcut state. `SteamDesktopSocial` owns local friend snapshots; `SteamLocalReader` isolates Valve DLL use in a utility process after Authenticode validation. Only snapshot, context, prepareInvite and invite are allowed through this private worker. The renderer never supplies DLL paths or arbitrary methods. SteamClient023, SteamUser023, SteamFriends018, SteamUtils010 and SteamMatchMaking009 are versioned interfaces; unavailable interfaces fail closed. No SteamAPI_Init or title impersonation is used.

Refresh is coalesced, bounded to once per five seconds, and backs off after errors. Avatars are cached by image handle and owner. Same-game filtering uses app IDs across different title localizations. Unknown names are resolved with bounded public store metadata requests, without user credentials. Disconnect invalidates pending snapshots; account changes recheck handoffs and invites.

Steam desktop mode does not create a CM/network Steam login or call SetPersona. The old SteamSocial implementation remains in source for parser reuse and regression evidence, but main instantiates SteamDesktopSocial only. Linux local Steam social access is not implemented and does not auto-fallback to network authentication.

Steam messaging uses an explicit fixed steam://friends/message/<validated-friend-id> handoff. No message text is transmitted. Lobby invites use InviteUserToLobby for the currently exposed lobby, rechecking local owner/app/friend immediately before submission. This new path needs a recipient-confirmed test; previous confirmed Dragonwilds invites used the former network session.

Checks: 75 unit tests (74 pass; one host POSIX skip), synthetic Electron overlay/tray/chat handoff smoke, and a live read-only local helper check finding kbunny_99 in the same Steam app as the owner with real avatars. User confirmed Alt+C over Dragonwilds before the local-session change. Windows packaged verification is recorded in VALIDATION.md after build. No real invitations/messages were sent in these checks.
