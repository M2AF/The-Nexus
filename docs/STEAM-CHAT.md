# Steam chat in Nexus

## Current implementation: restored account-backed chat

The user explicitly authorized returning to the earlier separate Steam connection so messages work inside Nexus while independent overlay development continues. main.js now uses SteamSocial, not SteamDesktopSocial. The steam-user/steam-session integration retains Steam Guard QR approval, encrypted refresh-token storage, chat UI mode4 and invisible persona7. It does not borrow a game app ID, announce a game, or run the native Nexus overlay.

Connected Steam friends advertise canMessage:true and externalChat:false. Message opens the existing Nexus conversation UI. History comes from FriendMessages.GetRecentMessages via steam-user, with real sender IDs/server timestamps; replies use sendFriendMessage. Chat events notify the UI and an open conversation refreshes every5seconds. Requests reject nonfriends, invalid text and stale history responses after account changes/disconnect. No automatic test message is sent.

A desktop-only saved preference has no token; Connect Steam must request fresh approval. A previously saved account token can restore through the normal encrypted store. Desktop Steam may be affected by the separate chat session; simultaneous status/friends behavior requires live verification. The user's authorization supersedes the earlier no-second-login requirement.

Source/unit, synthetic UI and packaged checks are separate from live account validation. The earlier failed candidate in dist/0.9.1-chat must not be confused with the restored candidate under dist/0.9.1-steam-chat. No release is published by this work.

## Earlier desktop-only experiments (inactive)

The 0.9.1 candidate prototypes in-client Steam Message actions while retaining the existing desktop Steam connection. LIVE RECEIVE VALIDATION HAS FAILED; this candidate is not release-ready. No separate Steam login, persona change, game identity assignment, or game-process injection is added. This work does not run the blocked native Nexus overlay.

The signature-verified SteamLocalReader utility process binds SteamFriends018 SetListenForFriendsMessages, ReplyToFriendMessage and GetFriendMessage. It polls only its own Steam pipe callbacks, reads GameConnectedFriendChatMsg_t messages in response to their callback, and keeps bounded per-friend text history in memory. The listener is disabled during orderly disconnect/shutdown. Stale Steam-account IDs and nonfriends are rejected before reading/sending; rejected sends do not append a fake outgoing message. No automatic message is sent by connection or validation.

Chat history covers messages received while Nexus is connected and replies sent from Nexus. It does not import older full Steam conversation history or promise support for every Steam chat media/group feature. Disconnect, process exit and account changes clear memory. If local chat initialization fails, the explicit Steam chat handoff remains available.

Official API references: https://partner.steamgames.com/doc/api/ISteamFriends#SetListenForFriendsMessages, #GetFriendMessage, #ReplyToFriendMessage. Global-client callback export compatibility and simultaneous Steam UI behavior require real-session validation in addition to unit tests.

Validation before packaging: 81 unit tests, 80 pass and one POSIX-only skip. Direct local probe confirms the message APIs bind and the listener is accepted, then disables it again; no private contents are printed and no real message sent. Synthetic UI testing and a user-coordinated live receive/normal-Steam check follow. Native Nexus overlay Defender submission restrictions remain unchanged.

## Live delivery investigation, November 11

The first 0.9.1 user test received the message in Steam but not Nexus. A second coordinated 60-second receive-only diagnostic reproduced this: Steam delivered presence callback 336 and unread-chat callback 348, but no GameConnectedFriendChatMsg_t (343), and no message was read. The earlier diagnostic without a test message was inconclusive. SetListenForFriendsMessages always returning true establishes neither delivery nor a usable capability. The current UI capability inference remains a prototype and must not be promoted as working.

A separate process-local callback-registration experiment completed with no hook invocations; no test-message confirmation arrived within its 180-second window, so it cannot validate receiving. it does not open another network session, assign a game identity, send messages, or alter Steam status. Its output is callback/count metadata only. No native Nexus overlay execution is involved.

## Default capability correction

The native helper now reports `available:false` for desktop chat by default. The existing desktop friends, presence and invite connection is preserved; in-client messaging cannot silently claim to work. Prototype listener testing requires `NEXUS_STEAM_CHAT_EXPERIMENTAL=1` in a diagnostic process. This is a development gate, not a proposed user setup step. The failed portable candidate has not been promoted or released. The latest user confirmed sending and receiving the registration-test message, but the confirmation arrived after the window closed; exact send time is unknown and the run showed no chat event or callback-registration hook invocation. No claim is made that a Steamworks app registration or any alternative route would resolve it without further validation.


## Legacy buffer receive test result

The user confirmed that the exact agreed incoming text `Nexus receive test` arrived in Steam. The subsequent SteamFriends002 read-only probe returned the same single type1 cached entry and `receiveMarkerFound:false`; the user-sent outgoing marker was also absent. Identity matched the current desktop account and the friend count was24. Thus neither marker test validates live delivery or author classification, and the earlier ability to read an entry must not be described as a working chat alternative. No conversation contents were printed and no messages were sent by the diagnostic.

Do not request more friend messages for these unchanged implementations. A further live test needs a materially different, evidence-backed transport first. Both tested desktop routes remain unvalidated for current message reception; the exact Steam-side cause is unresolved. No conclusion is drawn that every possible local integration is impossible. Keep the default capability guard, preserve desktop Steam behavior, and do not silently reintroduce the rejected second CM login, borrow a game app ID, or present external Steam chat as the requested in-client solution.


## Restored app confirmation

The user confirmed successful Steam Guard sign-in, Steam friends appearing and messages visible inside Nexus. This confirms the restored in-app history/display route in the user's session. The observer expired before collecting live counts, so no agent-observed callback/marker metadata is claimed. No test message was sent by the agent. Fresh outgoing recipient receipt and simultaneous desktop Steam status remain unverified. Keep the account-backed transport; the native overlay remains separate and unexecuted.
