# The Nexus

A standalone game launcher for Windows and Linux, adapted from DesktopX.

## Downloads and running the app

GitHub Actions builds are available from [Desktop builds](https://github.com/M2AF/The-Nexus/actions/workflows/build.yml). Open a successful run and download the Windows or Linux artifact. The repository is private, so downloading from GitHub requires repository access; a downloaded executable/AppImage can be shared separately.

- Windows x64: extract the artifact ZIP and open `The-Nexus-<version>-portable.exe`.
- Linux x64: extract the artifact ZIP, mark `The-Nexus-<version>-linux-x64.AppImage` executable (`chmod +x`), then run it. If the system cannot mount AppImages using FUSE, run with `APPIMAGE_EXTRACT_AND_RUN=1`.
- Quit an older Nexus from its tray menu before starting an updated build. Personal libraries, preferences and sessions are stored outside the executable in Electron's per-user app data directory.

## Development and automated builds

Use Node.js 24, then run `npm ci`, `npm run check`, `npm test`, and `npm start`. Package on the matching OS with `npm run build:win` or `npm run build:linux`. Windows produces a portable EXE; Linux produces an AppImage. No signing certificates or store/account secrets are required for these unsigned builds.

The pinned GitHub Actions workflow runs on pushes to `main`, pull requests, version tags, and manual dispatch. Both OS jobs run static checks, unit tests, package verification, SHA-256 generation and an isolated packaged UI/IPC smoke test. Linux smoke testing runs the executable extracted from the actual AppImage under Xvfb. Downloadable artifacts are retained for 14 days; smoke evidence is retained for 7 days. The Linux CI smoke test uses `--no-sandbox` only in its isolated hosted runner; the packaged app does not force that setting for users.

To prepare a release, update the version in `package.json` and `package-lock.json`, commit it, and push the matching `v<version>` tag. Once both builds pass, the workflow creates a **draft** GitHub release containing both builds and checksums. Publishing the draft remains a manual action in GitHub Releases. A tag that disagrees with the package version fails validation.

Optimized runtime branding is tracked under `app/assets`. Large original Canva/logo/video exports remain local in `Logos/`; builds do not require those originals. `dist/`, `output/`, dependencies, credentials, caches, local databases and personal library files are excluded from Git. CI also verifies an allowlist of packaged files.

## Linux support

Steam discovery supports standard and Flatpak Steam locations; Steam handles its own native/Proton game launching. Native executable files and AppImages can be added manually after enabling their executable permission. Discover, library imports, controller navigation and the Nexus UI are shared between platforms. Store buttons use registered Linux protocol handlers where available and otherwise open the website.

Xbox installation discovery, GOG Galaxy registry/cache integration, Windows shortcuts, and the Open on startup switch remain Windows features. This build does not add Heroic/Lutris integration or make Windows-only games native Linux applications. Linux packaging/startup checks do not replace testing games and controllers on a real Linux desktop.

## Installed, Owned and Web

- **Installed** discovers local Steam, GOG, Epic, Xbox and itch.io installations. Standard locations and Documents/Games are included. Settings lets you add other library folders. Xbox supports MicrosoftGame.config and AppX manifests and skips DLC/save directories. Moved GOG installations are read from goggame info files.
- **Owned** imports library records already synced in GOG Galaxy, including its Steam, GOG, Epic and Xbox connections. It reads the local SQLite database in read-only mode, without reading passwords, cookies or tokens. Library connections shows source/import/cache dates. Sync accounts in Galaxy, then Sync local libraries in Nexus. Multiple cached accounts require choosing one; libraries are kept separate.
- Without a Galaxy cache, import a JSON file with a games array. Each entry needs provider, platform id and name. Steam GetOwnedGames response JSON is also accepted; itch is a supported provider with a numeric game id. Launch commands, credentials and unapproved artwork URLs are discarded.
- Galaxy records can include console, shared, subscription, free or trial titles. A record is not independent license verification or a guarantee of PC compatibility/permanent ownership. Xbox records are labeled accordingly. Local installation alone is not used as proof of ownership.
- Uninstalled entries open Steam's install flow, a GOG game page, or the Epic/Xbox client. The platform client handles availability, licensing and installation. Nexus does not silently install games.
- Large libraries render 60 results at a time with Show more; search and filters examine the entire imported catalog.
- **itch.io** reads the itch app's local butler.db in read-only mode. Installed caves must have an existing install directory. Owned entries come only from the selected account's cached download-key/receipt and owned-bundle records, excluding browsed-only games and assets. Bundles/games that the itch app has not indexed cannot be imported yet; refresh them in itch and scan Nexus again. Multiple accounts require choosing one in Library connections. Nexus does not query or copy API keys or profile-data blobs. Launching uses the documented itch-setup --run-game route, with the documented itch protocol as fallback. Installation stays in the itch app.
- **Web** displays featured public Wavedash games with artwork and opens their canonical game pages in the default browser. Save game link lets you add any valid wavedash.com/games/game-name page; saved links and launch history survive refresh/restart. These are browser games, not local installations or evidence of account ownership. This version does not sync Wavedash account purchases, favorites, or paid-content entitlements. Existing sign-in and licensing are handled by the browser/Wavedash. If the public catalog is unavailable, prior cached entries, saved links and title-card fallbacks remain usable.

## Discover

A live public catalog brings Steam, Xbox PC and GOG games into one page. Search across stores, open one listing and choose the store to visit. The launcher opens the official product page; checkout and licensing stay with the store. No store account sign-in, API key or new runtime dependency is required.

- Explore, New arrivals, Coming soon and Deals use current public store listings. Top sellers combines the stores' Steam and GOG charts; Xbox does not supply a verified sales chart here. These are store-specific lists, not a global sales ranking.
- Categories includes 25 genres, themes and play styles, including open-world survival craft, RPG, strategy, building, co-op and relaxing games. Steam category searches use store tags; GOG/Xbox category coverage depends on the available source metadata and catalog sample.
- Mouse hover, keyboard focus and controller focus show previews with a short description, genres/features, release information and artwork where available. Steam/GOG metadata is requested only after a short hover delay and cached in memory for six hours. Some games have limited metadata.
- Store filters and region choices persist. Regions: Canada/CAD, US/USD, UK/GBP, Germany/EUR and Australia/AUD. Prices are public snapshots, may exclude tax and can differ from the signed-in store checkout. Subscription/member-only Xbox prices and console-only purchase listings are excluded. Unknown prices are never labeled free.
- Ownership badges use exact provider/product IDs from imported owned records. Installed-only records are labeled Installed; a local installation does not prove ownership. Unmatched IDs remain unbadged.
- Listings match normalized titles conservatively, retain edition names and separate ambiguous duplicate products within a store. Some valid matches will be missed. Verify the edition before buying. Catalog browsing is a bounded selection, not a complete mirror of each store.
- Catalogs refresh when opened if their six-hour cache has expired, and while Discover remains open. Searches cache for 30 minutes; the manual refresh button has a 30-second minimum interval. Failed sources retain their cached results and show a warning. Catalog data and preferences live separately in discover-cache.json and discover-preferences.json under the existing Nexus data directory.

Discover is independent of ChainLens and uses no wallet, blockchain or portfolio services. Searches send only the entered game query, selected category and store region to the respective public store endpoints; ownership matching stays local. Wishlist notifications and price alerts are not part of this version.

## Logo appearance

Settings & library → Logo color offers Blue/Cyan, Orange and Pink. A separate Animate logo toggle enables animation for the selected color. The choice is saved on this PC, applies to the sidebar and welcome artwork, and updates the window icon. Animated uses separate transparent orb and original wordmark layers: the background turns continuously through 360 degrees at constant speed every ten seconds, while the lettering stays fixed. The cycle joins seamlessly. System reduced-motion settings use the selected color’s still image instead.

App textures are full-color RGBA renders of the supplied artwork at 512px, sized for crisp launcher display. No GIF palette or black video background is used. The original exports remain in Logos; a full-resolution transparent animated SVG companion is available as Logos/The_Nexus_animated_transparent.svg. The Canva source was inspected read-only and its draft transaction cancelled without edits.

## Controller support

Windows/Chromium must expose the controller as a standard-mapped gamepad. Press a controller button while Nexus is focused to activate it.

| Input | Action |
| --- | --- |
| Left stick | Move the floating P1 glove cursor |
| D-pad | Move focus between controls |
| A / bottom face button | Activate the cursor target/focused control |
| B / right face button | Close the top panel or return to the main library view |
| Right stick up/down; LT/RT | Scroll under the cursor/current focus |
| LB / RB | Cycle Installed / Owned / Web tabs |
| Start / Menu | Open settings |

Text fields open a QWERTY on-screen keyboard with Shift, digits, punctuation and caret editing; chat also has a New line key. Select controls open a controller-accessible choice dialog. D-pad focus stays in the active dialog. Actual mouse movement hands control back to the mouse. Gamepad input stops when the app loses focus, so it does not operate the launcher while a game is in front. Arrow keys also move spatial focus outside text fields.

Windows file/folder dialogs are native system windows using Windows input handling. Controller support covers the Nexus UI, including its keyboard and choice dialogs.

## Library features and artwork

Search, platform filters, favorites, recently launched games, sorting, grid/list views, game details, executable/shortcut imports, folder access and JSON export are included. Launch history records Nexus requests, not time played or proof of successful game startup.

The supplied Nexus logo is used for branding, favicon and Windows icon. Official platform SVGs and Lucide controls replace placeholder symbols. Installed Steam artwork uses legacy/modern caches and official CDN downloads; GOG uses its catalog/product artwork; Xbox uses installed package artwork. Owned entries use Galaxy's recorded artwork URLs. Details allow selecting PNG/JPEG overrides. Missing images retain a title card. See ASSETS.md for sources/licenses.

## ChainLens friends and chat

Friends & chat opens ChainLens sign-in in your default browser. Approve The Nexus there, then return to the launcher. The launcher receives a revocable social-only credential, not your browser login or wallet credentials. Windows protects the remembered credential in a separate `chainlens-session.enc` file; library export does not include it. Sign out removes it and attempts server revocation. Sessions expire after seven days.

The panel supports incoming/outgoing friend requests by ChainLens ID, online state, unread counts, direct messages, emoji, GIF previews and explicit Send. Chat keeps ChainLens's existing eligibility rules: a verified non-watch wallet and a linked Google or Discord account. GIF search uses the service's GIPHY configuration; a direct GIPHY media link can also be attached. Messages and friendships are stored by ChainLens. Message drafts stay in memory and clear on sign-out. Account setup and browser consent use the browser's input handling.

**Service status:** the ChainLens integration and the 0.4.1 account-only backend follow-up are live. The launcher uses a dedicated account-only browser page and fixed Google/Discord return path. Saved profile pictures load from HTTPS media hosts such as Cloudinary and supported inline uploads, with no wallet/collection scans. The launcher refreshes account identity and friend pictures without losing a chat draft. No production messages or friend requests were sent during verification.

## Data and development

Data lives in `%APPDATA%/The Nexus/library.json`; downloaded/custom artwork lives alongside it. Game-library metadata stays on this PC. ChainLens social data uses the ChainLens service when signed in. Artwork is requested from approved publisher/CDN hosts. The original logo is unchanged. The portable executable is unsigned.

- `npm run check`: JavaScript syntax validation; no TypeScript/lint tooling is configured.
- `npm test`: discovery, launch, ownership merging/import and read-only database regressions.
- `npm run build:win`: portable Windows x64 build.

Native filesystem/process operations stay behind narrow preload IPC. Launch requests use stored installed-game keys; ownership imports cannot supply executable paths or commands. lib/catalog.js reads/merges owned metadata, app/controller.js handles input, lib/indie-platforms.js adapts itch.io and Wavedash, and discovery runs in a worker.

Export is a readable metadata backup, not a complete state restore. To restore full local state, close Nexus and restore its original library.json and artwork directory from a filesystem backup. Cloud saves, a replacement DRM system, and direct download engines are not provided. Native connections and install tracking are described below.

## Window and startup controls (0.5.1)

The title bar and slim scrollbars match the dark Nexus background. Standard Windows caption controls remain available. The upper-right fullscreen button and F11 share the same fullscreen toggle. Settings & library includes an opt-in Open on startup switch, backed by Windows startup settings. Portable startup points to the original portable executable, not its extracted temporary files; keep that executable in a permanent folder. Startup is disabled in development builds.

Library list view uses three compact horizontal tiles per row on wide windows, two on medium windows, and one on narrow windows. The executable icon now uses the current supplied blue/cyan logo with nine embedded icon sizes.

## Discover update (0.5.2)

Discover store actions prefer the installed Steam, GOG Galaxy, Xbox or Epic client. Windows resolves the registered protocol; missing or failed handlers use the validated website instead. Actions open a product page only and do not buy, install, or launch the game.

Epic Games now appears in Discover using its public regional PC promotions feed, including current paid/free promotional listings and upcoming highlights. This is a curated subset, not the full Epic catalog: broad anonymous catalog requests are currently rejected. Search/category filters apply to the available Epic highlights; verified Top sellers remains Steam/GOG. Epic artwork, descriptions, product slugs, regional currency and current prices come from Epic. DLC, code-only offers and expired offers are excluded; a future or expired giveaway is never labelled free on that basis. Store preferences migrate to include Epic once, then preserve the user's choices.

The desktop sidebar removes the local-library footer message and early-access label, retaining Settings at the bottom. Compact desktop-height rules keep navigation visible without sidebar scrolling at the tested window sizes, down to 800×600.

## Cross-store matching fix (0.5.4)

Identical game titles now share one Discover listing even when platform/store arrival dates differ. Trademark symbols are removed before Unicode normalization so ™ does not become an extra TM word in the matching key or cross-store search. Edition names remain significant, and multiple distinct products with the same name in a single store remain ambiguous. Existing cached catalogs automatically regroup under the corrected matching rules; no library rescan or preference reset is required.

Live Cyberpunk 2077 verification: one base-game card for the GOG/Xbox browse entries, with Steam also found when opening the card’s store choices. Ultimate Edition remains a separate purchase listing.

## Rich game descriptions (0.5.5)

Store choices sit directly below the game title, before the artwork and long description. Details preserve supported store description formatting and inline images/GIFs from approved store CDN hosts, followed by the existing gallery of up to four screenshots. Empty blocks, repeated blank breaks and source layout styles are removed, so missing media cannot reserve a large blank area. Steam and GOG supply full description content when available; Xbox full descriptions are retained too. Plain descriptions fall back to normalized text. Reopening a game starts the dialog at the top.

Store HTML is rebuilt into a limited set of passive DOM elements. Scripts, frames, forms, embedded objects, inline styles, event handlers and arbitrary image sources are discarded. The app does not execute store-supplied code or embed store checkout pages.

## Browse controls (0.6.0)

Discover now has 26 categories, including Shooters. In Categories, the large tile grid stays visible and a selected category’s games appear beneath it. Top sellers, New arrivals, Coming soon, Deals and Free-2-Play have compact category buttons; their category combines with the active tab and search query. All categories clears just the genre filter. Explore retains its existing unfiltered category layout. Steam and GOG supply category-specific top-seller results; Xbox and Epic are not presented as verified sales charts.

Free-2-Play only shows current, verified free base games. Steam’s explicit free flag, GOG’s zero regular/final prices, Epic’s zero regular price, and verified Xbox non-subscription zero-price offers establish eligibility. Demos, trials, playtests, unknown prices and temporary giveaways are excluded. Coverage remains bounded by each source; Epic remains limited to its public PC promotions feed. Steam’s batch store metadata supplies current prices, tags and hashed artwork paths for filtered results.

Library has its own seven independent store/source toggles, saved locally and separate from Discover preferences. Favorites sort before other Installed/Owned entries, with the selected sort applied within each group. Recent launches remains chronological. Show all games restores store visibility as well as clearing ordinary filters.

## Portal appearance

Settings & library includes a Portal theme picker for the background and buttons/headers. Choose hue, saturation, brightness and opacity, enter a hex color, or sample a color with the eyedropper when available. Changes preview immediately; Save theme keeps them on this PC. Closing Settings discards unsaved previews. Reset restores the original colors. Text and neutral surfaces adapt to the selected colors. Logo color and animation remain independent.

The window has no separate title bar, title text or corner logo. Drag the empty area of the existing top header to move it, or double-click there to maximize/restore. Compact fullscreen, minimize, maximize/restore and close controls remain in the header; F11 also toggles fullscreen.

The top header contains one shared search bar. It searches the active Library shelf as you type (or with Search Library), and submits Discover searches with Search Stores. Each page retains its own query; Discover keeps category, section and store filters. Press / to focus the shared field. Scan library is beside Library connections.


## Friends, contacts, and installation tracking (0.7.0 preview)

Friends & chat fills the entire app window with a friends-first hub with All friends / Online / Playing filters, search, grouped presence, platform badges, and a connection rail. Selecting a person opens a compact profile; Message opens a conversation. The row also has a direct Message shortcut. ChainLens friends appear alongside native Steam and Discord friends. ChainLens conversations retain their existing emoji/GIF picker. Native Steam/Discord messages currently support text and Unicode emoji, not a GIF attachment picker.

Merge friends lets you select accounts belonging to one person. Choices are saved locally in contacts.json, independent of the platform accounts. A merged conversation has a Message via selector; Separate account reverses the merge. Names and avatars never establish identity. The contact model can consume verified stable-ID link edges from an adapter, but the current desktop Discord Social SDK does not expose friends' Xbox/PlayStation connection IDs; no automatic cross-network identity matching is claimed.

| Platform | Current connection / features | Limits |
| --- | --- | --- |
| Steam | User-approved Steam Guard QR login, owned library import, friends/presence, text DMs, achievement view | Achievements use Steam Community's game/profile XML support and can be unavailable/private. Live account validation is still required. |
| Discord | Official Social SDK desktop PKCE login, friends/presence, text DMs | Requires communication access/consent for this application. No client secret is included. Live account validation is still required. |
| ChainLens | Existing account-only profile, friends/requests, presence, emoji/GIF messages | Existing account chat permissions apply. No wallet, NFT, portfolio, or crypto RPC integration is added. |
| Xbox / PlayStation / GOG / Epic social | Not connected | Separate platform adapters and appropriate account/API access are still required. |

Steam integration uses the maintained steam-user and steam-session clients. Discord uses SDK 1.10.19337 in an isolated Electron utility process. A native SDK crash cannot crash the renderer/main process. Refresh tokens are stored only through OS-backed Electron safeStorage, without a plaintext fallback. On Linux, basic_text is explicitly rejected. Disconnect clears the local platform credential; ordinary app exit preserves remembered credentials. No Winhanced binaries, tokens, sessions, or services are used.

Owned Library games and exact owned Discover store editions have Install with [store] actions. Steam and itch.io use game install protocols; GOG opens the exact Galaxy game view; Xbox opens a known product page when a product ID is available; Epic currently opens the launcher, where the user selects the title. Store clients still perform the installation. Nexus does not download game payloads itself.

Downloads tracks Steam's actual local manifest byte counters, transfer state, pause, verification, speed and ETA where available. Missing counters remain unknown. Other clients show Waiting for the store client until a real installed library record is discovered; transfer percentages are not fabricated. Removing tracking does not cancel the client transfer. Installation records are bounded metadata in installations.json. Partially downloaded Steam installs are excluded from the installed scanner until Steam's installed flag is present.

Validation: npm test, npm run check, npm run smoke:platforms. The platform smoke uses synthetic accounts and IPC responses, initializes the real Discord SDK offline, and never signs in, sends a real message, or starts a real game download. The Windows and Linux build workflow runs the synthetic social/install smoke after packaging. Windows package checks also validate SDK resource bytes and exclude personal library/session/contact/install files. This feature preview has not yet been verified on Linux or against real Steam/Discord accounts.


### Open chats (0.7.1 preview)

The Friends hub includes Open chats, with a count of currently open people/conversations. Message opens a chat; returning to Friends or closing/reopening the hub keeps it available for this app session. Selecting an Open chats row resumes the most recently used platform for that person. Merged contacts appear once, with Message via available for their accounts. Close chat removes the person's open conversations without deleting platform messages or removing friends. Native drafts remain in memory while switching chats. Open-chat metadata is tied to the connected account and is not exposed when another account signs in. Open chats reset when Nexus exits; no message history or drafts are written to disk by this feature.


## Linked accounts (0.8.0 preview)

The top Accounts button links verified platform identities to a signed-in ChainLens ID. Steam and Discord remain native connections. Xbox and Epic use browser approval, then a one-time server-to-desktop session handoff; app client secrets stay on the ChainLens backend. Platform sessions are encrypted locally where secure storage is available. Reconnect when Xbox/Epic sessions expire. Unlinking a ChainLens identity and disconnecting a local platform session are separate controls.

Merged contacts prefer Discord profile/name/avatar and default messaging, then Steam, then ChainLens for messaging. Verified links from accepted ChainLens friends can join stable platform IDs automatically; matching names alone never merge people. Explicit Separate persists and prevents automatic regrouping. Only a platform account's owner can verify its link; manually grouping a friend's accounts is a local contact preference, not proof of account ownership.

Xbox friends/profile/presence access depends on service permission and user privacy. Epic's REST friends list includes only users who authorized this application, with presence unavailable. Xbox/Epic direct messaging is not available in this preview; Message stays disabled unless that person also has a connected Steam/Discord/ChainLens messaging account. The account-link backend is live; public Epic branding/domain review and real Xbox/Epic consent/API validation remain pending. No account client secret is included in the executable.

### Steam lobby invitations (0.8.4)

On Windows x64 Nexus reads the running Steam client's current lobby through versioned Steamworks interfaces in an isolated utility process. The installed Valve-signed library is verified before loading; no Steam DLL, game credentials, or lobby target is bundled or exposed to the renderer. Right-click a friend, choose Invite via Steam, then Send game invite. A current exposed Steam lobby takes priority over the invitation message fallback. Account, current game, lobby and friendship are checked again when sending.

One real Dragonwilds invite from Nexus code was confirmed received by the chosen Steam friend; joining was not tested. Submitted means the lobby protocol was queued, not that every recipient has received or joined it. ROB RUN's tested session did not expose a Steam lobby and its own party invitation is separate. The Windows local-lobby path does not establish Linux or every game's invite compatibility. That earlier network-session implementation used a separate Nexus Steam session. Current builds use the existing Steam desktop session instead.

## Overlay, tray and in-client Steam chat (0.9.1 candidate)

**Steam chat restoration:** the user authorized returning to the earlier separate Steam sign-in so messages can be handled inside Nexus. The failed desktop-only listener is inactive. Approve Connect Steam through Steam Guard; a desktop-only saved preference has no refresh token. Fresh live sign-in and receive/reply validation are separate from fixture checks. See `docs/STEAM-CHAT.md`.

Alt+C toggles Nexus friends/chat over borderless or windowed games. Closing the main window keeps Nexus running in its tray by default. The tray offers Open The Nexus, Friends overlay and Quit The Nexus. Settings can disable background mode or the shortcut. Exclusive fullscreen may require borderless mode; no game injection is used. The overlay reuses the main app state and keeps unsent drafts in memory.

Steam friends, names, avatars, game activity, owned-library sync and chat now use the account-backed SteamSocial connection again. Its earlier chat UI mode and invisible persona are retained. Messages have real sender IDs and server timestamps; stale history responses are rejected after disconnect or account change. Sessions are saved through the operating system's encrypted storage. This is a separate Steam session, and simultaneous Steam status/friends behavior needs a fresh live check. No message is sent automatically and no game app ID is borrowed.

Playing includes friends with current game activity on any linked account. Same game compares Steam app IDs when both sides provide them; other platforms use exact normalized game titles. A merged contact appears once and retains its preferred profile while activity can come from any member. Missing/private activity cannot be inferred.

Steam-only friends expose Message, opening the existing Nexus conversation UI with recent history and replies. Discord and ChainLens chat remain in Nexus. The experimental local-only listener is not used as the restored chat transport. Independent native overlay development and its execution restrictions remain separate.

Steam lobby invite submission now calls the running client's local lobby API with fresh account/game/friend checks. The earlier network-session invite receipt test does not validate this new submission path; recipient confirmation must be repeated. No invitation or message is sent automatically.


## Blizzard / Battle.net (0.9.2)

Battle.net appears above itch.io in Library's sidebar and store toggles, and is selectable in Discover. Discover refreshes thirteen supported Blizzard PC base-game listings and official artwork from Blizzard's public games page. Search, genres/categories, Free-2-Play and cross-store matching use the existing Discover UI. Paid prices are checked at the store; no unverified prices, discounts, release dates or best-seller rankings are invented.

Installed games are found through the read-only Agent product.db, uninstall records, and active .build.info records in normal/custom library folders. A supported game executable must exist; client components, stale paths and unsupported beta/PTR records are excluded. Launches use the installed Battle.net client. Owned-library import supports Battle.net records from an existing GOG Galaxy sync or a library JSON file; installing/signing into Battle.net alone does not import all account entitlements.

Discover prefers the installed client's game page and falls back to its official website. Owned-game installation opens the client page; Battle.net manages the download and Nexus marks it installed after a library scan. Battle.net byte/percentage progress is not exposed. Steam chat and native overlay behavior are unchanged by this integration. See docs/BATTLENET.md.
