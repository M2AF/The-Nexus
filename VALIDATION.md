# The Nexus 0.5.0 — validation

## Discover release

The Windows x64 portable artifact is dist/The-Nexus-0.5.0-portable.exe. Syntax checks and all 26 Node tests pass. No lint or TypeScript tooling is configured. No runtime dependency was added.

Discover adds live public Steam, Xbox PC and GOG catalogs, normalized game/edition matching, explicit official-store choices, regional prices, preferred-store filters, exact-ID ownership/installation badges, new arrivals, coming soon, deals, Steam/GOG top sellers, 25 genre/theme/play-style categories and delayed hover/focus previews. Screenshots, descriptions, genres/features and release dates use available public store data. GOG full-game packages/collections are included so complete editions are discoverable.

Native Electron checks use live catalogs with isolated local user data; shell opening is intercepted, so no purchases occur. The Halo: The Master Chief Collection listing offers Steam app976730 and Xbox PC9NTM9HXNLSZX and excludes console-only9MT8PTGVHX2P. Checks cover all three source feeds, live category results, hover descriptions/genres and loaded artwork, Top sellers, 25 Categories, exact ownership badges seeded only in the isolated fixture, store opening, preference persistence across reload, keyboard/controller focus previews, A/B actions, shoulder-button category switching, library navigation and 1440/800/390px containment. Screenshots were reviewed. output/check-discover.cjs; output/discover-native-results.json; output/playwright/discover-{desktop,top-sellers,categories,hover,halo-stores,mobile}.png.

Existing packaged social, controller and installed-library suites pass: consent/PKCE, encrypted credential restore, friends/emoji/GIF, QWERTY chat editing, gamepad pointer/scroll/dialogs, 21 installed games with artwork, favorites, imports, safe launch/history, removal and export. These use isolated profiles and fictitious social accounts; no production messages or friend requests were sent. Controller tests use simulated standard-mapped input; physical-device testing remains separate.

Unit regressions cover strict store URL/artwork validation, title/edition ambiguity, unknown versus free pricing, Windows/console filtering, PC purchase availability, cache coalescing, offline fallback, region isolation, preference restoration, and GOG genre/package contracts. Public storefront endpoints and embedded Xbox catalog formats can change; failing sources retain cached results with visible status. Browsing is a sampled catalog, and category/matching coverage varies. Top sellers has no verified Xbox sales chart. Store checkout confirms current regional price/availability/edition. No wishlist alerts, automatic purchases or background installation are included.

## Logo selector and animation

Three colors (blue/cyan, orange, pink), each with a separate animation toggle, pass source native checks for loading, cold-start persistence, rejection of arbitrary paths, controller selection, mobile dialog containment and reduced-motion behavior. The animation uses transparent orb/wordmark layers rendered from the supplied SVG; static colors use the supplied exports. Original files and the Canva design are preserved. All seven generated textures are RGBA with transparent corners and graded alpha; the display assets total roughly 2.2MB. A full-resolution animated SVG master is in Logos/The_Nexus_animated_transparent.svg.

Native animation checks sample zero, quarter, half, three-quarter and full turns: easing is linear, opacity stays one, the zero/full-turn transforms are identical, and the wordmark transform remains none. This verifies a continuous seamless rotation without fades or pauses. Reduced motion selects the still image while preserving the saved preference. output/check-appearance.cjs, output/appearance-results.json and output/playwright/logo-{animated,pink}-settings.png.

## Implementation files

- lib/appearance.js, app/appearance.js and app/appearance.css: validated logo preferences, saved setting, live branding and smooth reduced-motion-aware animation.
- app/assets/branding/*.png and Logos/The_Nexus_animated_transparent.svg: faithful transparent derivatives from supplied sources.
- test/appearance.test.js: fixed preset/path validation.
- lib/discover.js: store adapters, metadata, conservative matching, cache/preferences, fixed links and source validation.
- app/discover.js and app/discover.css: Discover page, filters, store dialog, categories and focus/hover previews.
- main.js and preload.js: narrow Discover IPC and local ownership projection.
- app/index.html, app/app.js and app/controller.js: navigation, library update event, version, scoped search shortcut and controller category/preview support.
- app/assets/icons/compass.svg: existing Lucide asset.
- test/discover.test.js: catalog regressions.
- package.json, package-lock.json, README.md, ASSETS.md, VALIDATION.md: version/checks, usage, provenance and evidence.

## Previous 0.4.1 evidence

Current portable: `dist/The-Nexus-0.4.1-portable.exe`, SHA256 `31FB59B63743615E12EB6FAE3ABC6F0A6EBD7DC04DADFD072C8525464989665C`. All 20 desktop tests and 300 ChainLens backend tests pass, with syntax checks. The packaged social fixture, controller suite and installed-library runtime checks pass with no renderer errors.

New native checks verify loaded Cloudinary-style NFT and uploaded friend PFPs, username and picture refresh without draft loss, circular photos versus saved NFT framing, QWERTY rows, controller caret insertion/newlines without sending, 390px containment and cold credential restoration. The standalone account page request allowlist contains only account assets and `/api/nexus/account`; no portfolio, wallet, collectibles, Alchemy or Helius requests occur in that fixture. Google/Discord actual route handlers are tested against stubbed provider responses for fixed Nexus callbacks, errors/replays, normal web compatibility and rejection of unissued states. Evidence: `output/social-results.json`, `output/playwright/social-{nft-avatar,avatar,qwerty}-fixture.png`, `output/playwright/nexus-account-only-fixture.png`.

Initial server release a259912 is live and the user completed sign-in. The follow-up account-only backend is live: exact deployed account-script SHA256 matches, config enabled, account/native unauthenticated calls denied, invalid grants denied, Google/Discord failure destinations use the standalone page, and consent points to it. An unissued prototype state is rejected at the edge with HTTP 403; no claim is made that this probe reached the backend. Evidence: `output/social-live-verification.json` and `output/check-social-live.cjs`. No production social messages or friend requests were sent.

## Earlier 0.4.0 evidence

## ChainLens social integration

Portable artifact: `dist/The-Nexus-0.4.0-portable.exe`. Syntax checks and all 19 desktop tests pass. ChainLens passes syntax checks and all 295 backend tests. The generated private-session migration passes actual ephemeral PostgreSQL grants, RLS flag, expiry constraint, anon denial and account-delete cascade checks.

Native Electron tests use the real first-party consent HTML/JS and bridge module against a local in-memory service with fictitious accounts. They cover browser consent, state/S256/loopback exchange, Windows DPAPI credential storage, renderer credential isolation, friends/requests, online state, direct messages, emoji, explicit GIF preview/Send, nonfriend rejection, cold restore and sign-out revocation. Desktop and 390px layouts were reviewed. Evidence: `output/social-results.json`, `output/playwright/social-{desktop,mobile}-fixture.png`, `output/playwright/chainlens-consent-fixture.png`, and `output/check-social.cjs`. No production messages, friend requests or account changes were made.

Final 0.4.0 packaged checks pass the complete social fixture, simulated standard controller suite, and native installed-library runtime suite (21 discovered entries, all with artwork). Library checks include favorites across reload, search/filter/list layouts, details, manual import, safe launch/history, removal and export. Controller checks include focus, A/B, tabs, analog cursor, scrolling, modal containment, keyboard and selection dialogs. The native driver runs `dist/win-unpacked/The Nexus.exe`, the application bundled into the portable artifact.

Live sign-in remains pending: production currently serves HTML fallback at `/api/nexus/config`. The private session migration and scoped ChainLens deployment have not been applied. GIPHY search additionally requires the backend's existing GIPHY key; direct GIPHY media attachments work without search. Actual user-account consent and physical controller testing remain separate checks. Social traffic uses ChainLens; game-library metadata stays local.

## Previous 0.3.0 launcher evidence

Validated locally on Windows on November 7, 2026.

## Result

The portable Windows x64 build succeeds at `dist/The-Nexus-0.3.0-portable.exe`. The packaged app in `dist/win-unpacked/The Nexus.exe` (the same packaged application bundled by the portable executable) passes all native checks below through Playwright's Electron driver.

- `npm run check`: passes for main, preload, renderer, controller, catalog, discovery, artwork and launch modules. Plain JavaScript; lint/TypeScript are not configured.
- `npm test`: 16/16 regressions pass. Coverage includes validated launch targets, GOG arguments, duplicate handling, registry parsing, modern Steam artwork paths, moved Xbox AppX/Game.config installs, moved GOG info files, DLC filtering, owned/installed reconciliation, import command stripping, and read-only SQLite access.
- `npm run build:win`: passes; portable executable includes the supplied Nexus branding and native Windows icon.
- Native installed-library checks pass startup, actual discovery, favorites across reload, search/empty results, platform filters, grid/list switching, game details, custom artwork, library-folder selection, executable import, launch requests, persisted history, removal and metadata export. Twenty-one installed entries are found: fourteen Steam entries, four GOG games, Forza Horizon 6 and Vampire Survivors on Xbox, and Brütal Legend from itch.io. All twenty-one display artwork.
- List geometry is checked at 1920, 1440, 800 and 390 CSS pixels: one card per row, readable titles, actions within bounds, no overlap with favorites, and no horizontal overflow. Platform badge icons are checked for vertical centering.
- Owned-library checks pass automatic cache import, Installed/Owned separation, 60/120-result pagination, full-catalog search, uninstalled status, favorites across reload, rejection of direct launches for owned-only records, native JSON import, stripping of supplied launch commands/untrusted art, and the correct client/install action. The local Galaxy cache provides 949 visible licensed library entries: Steam 155, GOG 59, Epic 78, Xbox 657. The independent itch.io cache adds one indexed owned game, for 950 owned library entries in total. These are source library records, not an independent audit of permanent purchases or PC compatibility.
- Controller checks pass D-pad spatial focus, A activation, B back, LB/RB tabs, modal focus containment, on-screen keyboard, controller-accessible select menus, analog cursor movement/click, right-stick scrolling and disconnect cleanup. They use a simulated standard-mapped navigator.getGamepads device in the packaged renderer. LB/RB cycling through Installed, Owned, and Web is included. No physical controller was tested; device mapping, wireless behavior, input latency and subjective cursor feel remain unverified.
- Upgrade checks use a separate copy of the user's saved library. Automatic refresh preserves all four favorites, history and artwork overrides while refreshing moved installations and owned metadata. The original profile is not modified by these checks.
- No renderer exceptions occur in the installed, owned, controller, or indie-platform checks.
- Desktop, compact, mobile, wide list and Owned/controller screenshots are captured and reviewed. The native app minimum remains 800 x 600; the 390px check validates renderer responsiveness only.

Real game startup and downloads are not exercised. A harmless temporary whoami.exe import is used to check process launching, then removed. Owned client/install actions are checked without initiating a game installation. Windows-native file/folder choosers use Windows input handling; the in-app controller does not control those system windows.

## itch.io and Wavedash checks

- itch.io's actual local butler.db is opened read-only. One installed game (Brütal Legend) and one cached owned game are found. Browse-only games and non-game assets are excluded from ownership; purchase/download-key and owned-bundle metadata is scoped to one account. Multiple accounts require a choice. No API-key or profile-data columns are selected. Fixtures verify account isolation, stale-directory rejection, ownership distinctions, and unchanged database bytes.
- The itch.io native UI filter, artwork, logo, Owned/Installed reconciliation and Play action are checked. The documented itch-setup --appname itch --run-game route and protocol fallback are validated as launch plans without actually starting the game.
- Wavedash's public home page yields 24 featured browser games with real artwork. They appear only in Web, with web=true, installed=false and owned=false. This is not an account catalog or ownership/paid-content sync.
- Native Web checks verify canonical game pages, browser dispatch through mocked shell.openExternal, saved links, tracking-query removal, deduplication, persistence, launch history and invalid-host rejection. No browser game is actually started during the checks.
- Unit checks cover duplicate public cards, punctuation/HTML entities, exclusion of tags/foreign origins, protocol validation and rejection of imported commands. Public HTML is size/time limited and never evaluated as code. Existing cached metadata, favorites/history and saved links remain stored when public catalog refresh fails.
- Official platform logos are present: itch.io from Simple Icons and Wavedash's own favicon SVG. itch.io image hosts and Wavedash's uploads CDN are explicitly allowed in the renderer image policy.

## Evidence

- `output/indie-results.json`, `output/check-indie.cjs`
- `output/runtime-results.json`, `output/check-runtime.cjs`
- `output/owned-results.json`, `output/check-owned.cjs`
- `output/controller-results.json`, `output/check-controller.cjs`
- `output/migration-results.json`, `output/check-migration.cjs`
- `output/playwright/library-desktop.png`, `fixes-list-1920.png`, `owned-controller.png`, compact/mobile captures, itch-library.png and wavedash-web.png

The CLI browser cannot open local file URLs, so native testing uses the existing Playwright Electron driver. Test profiles and fixtures live under timestamped output directories outside the user's actual app profile. Galaxy and itch.io databases are opened read-only; no account credentials are read or copied.

## Files changed in this iteration

- `main.js`, `preload.js`: configured library roots, upgrade scan, read-only ownership import, scoped import/client actions and artwork fallback.
- `lib/scanners.js`, `lib/scan-worker.js`: moved Xbox/AppX and GOG discovery, artwork and catalog integration.
- `lib/artwork.js`: actual GOG vertical covers with exact product-id matching.
- `lib/catalog.js`: read-only Galaxy reader, safe JSON import, installed/owned reconciliation, approved artwork hosts and fixed client routes.
- `lib/indie-platforms.js`: itch.io read-only cache adapter and Wavedash public metadata/link adapter.
- `lib/launch.js`: documented itch.io launch routes and strictly validated Wavedash HTTPS game routes.
- `app/app.js`, `app/index.html`, `app/styles.css`: Installed/Owned tabs, source controls, full-catalog filtering, pagination, corrected list layout, centered platform marks, Web view, saved browser links, indie platform filters and source statuses.
- `app/controller.js`, `app/controller.css`: P1 glove cursor, analog/D-pad input, scrolling, focus management, on-screen keyboard and select dialogs.
- `test/launcher.test.js`, `test/catalog.test.js`, `test/indie-platforms.test.js`: discovery, ownership and indie-platform regressions.
- `package.json`, `package-lock.json`: version 0.3.0 and syntax checks.
- `README.md`, `ASSETS.md`, `VALIDATION.md`: usage, ownership provenance, controller mapping and current evidence.

DesktopX, Agent Office and the original supplied logo are unchanged. The standalone executable remains unsigned. Owned sync depends on existing Galaxy/itch.io cache records or explicit library-file imports; direct platform OAuth/API account sign-in is not implemented. Refresh accounts in Galaxy for new purchases, then sync Nexus. No cloud saves, achievements, direct game updates or playtime tracking are provided.

The itch.io import contains only titles already indexed in that client's cache. Wavedash integration uses public featured games and explicit saved links, not the signed-in user's catalog, purchases, cloud saves or paid-content entitlements. The user signs in and plays through the platform's existing client/browser session. Final packaged checks all pass: installed library, owned library, controller, indie platforms and migration. The original profile's four favorites, history and artwork overrides remain preserved in the migration test copy.

Final appearance update: three dropdown colors plus one persistent animation switch; all six combinations, controller toggle activation, reduced motion, and cold-start persistence checked in native Electron. Orange/pink orb colors use native SVG color matrices fitted to the supplied static exports (mean channel deviations about 5/255 and 4.4/255); the original lettering stays fixed.

## 0.5.1 window polish

Changed main.js and preload.js for native themed title-bar overlay, bounded window actions and Windows startup IPC; lib/window-settings.js validates the permanent portable launch target. app/window.js, app/window.css and app/index.html provide the fullscreen button, startup switch, dark scrollbars and responsive three/two/one-column list tiles. app/assets/icon.ico and icon.png use the current brand; package files advance to 0.5.1.

Static checks and 28 unit tests pass. output/check-window.cjs validates responsive list geometry at 390, 800, 1000, 1200, 1440 and 1920px, fullscreen button/F11 parity, and a temporary isolated Windows startup registry entry (removed after the test). Existing user startup settings are never changed by validation. Actual reboot/sign-in is not performed. Screenshots and machine-readable evidence are in output/playwright/window-*.png and output/window-results.json.

Packaged 0.5.1 checks passed for window chrome/fullscreen/startup registration, real library scan/artwork, favorites and history persistence, import/export, responsive list layout, all logo combinations and controller navigation. The Windows-extracted portable EXE icon was rendered and inspected. Temporary validation startup entries were removed.

## 0.5.2 client-first Discover and sidebar

Changed lib/store-opening.js, lib/epic-discover.js, lib/discover.js and main.js for bounded client URI routing, installed handler detection, website fallback and curated Epic PC metadata. app/discover.js, app/index.html and app/window.css add the Epic filter, client-opening feedback, permanent coverage disclosure and compact sidebar footer. Package files advance to 0.5.2. Unit checks cover installed/missing/broken client routing, safe product-page URLs, Epic base-game/DLC filtering, giveaway timing and legacy store preferences.

Live data returned 11 Epic PC highlights with real artwork. Broader Epic catalog requests returned Gone/403 and are not bypassed; no full catalog or Epic top-seller coverage is claimed. output/check-store-routing.cjs verifies all four provider handoffs/fallbacks with shell opening intercepted, actual OS handler lookup, live Epic cards, and sidebar fit at 1920×1080, 1440×940, 1426×932 and 800×600. Product-page handoffs are tested without purchases or game installs. output/store-routing-results.json and output/playwright/epic-*.png contain evidence. Source protocol references: Epic's Protocol Activation guide, Microsoft GDK Xbox product-page documentation, Steam browser protocol, and the GOG external URL handler shipped in Galaxy.

The Discover regression also caught previews canceled by the scroll event generated while a card moved under the mouse. app/discover.js now re-evaluates the card beneath a stationary pointer after scrolling settles, retaining the delayed preview. Unit suite: 33 tests passed; native Discover checks cover this scroll/hover case.

Final artifact version is 0.5.3 because the already-running 0.5.2 portable executable was locked. The running user application was left open; only the waiting builder was stopped, and the final build used a new filename.

## 0.5.4 cross-store identity fix

lib/discover.js no longer treats a gap in store-specific arrival dates as evidence of a different game. Same-store duplicate-product guards and edition-sensitive names remain intact. Trademark symbols are stripped before NFKD normalization in identity/search matching. test/discover.test.js covers 2020 GOG versus 2026 Xbox dates, trademark differences, separate Ultimate Edition, regrouping existing cache rows and finding an additional Steam choice from the merged key.

34 unit tests pass. output/check-cyberpunk.cjs uses current public store catalogs to verify one Cyberpunk base-game card, GOG/Xbox offers in the browse feed, Steam app 1091500 in the expanded three-store dialog, and a separate Ultimate Edition in search. Evidence: output/cyberpunk-results.json and output/playwright/cyberpunk-*.png. Product pages were not purchased or installed.

Packaged 0.5.4 validation passed the live Cyberpunk workflow and the broader Discover regression suite (four source feeds, categories, hover, store handoffs, preferences and controller previews). The main browse catalog has one fewer card because the two Cyberpunk entries now merge.

## 0.5.5 rich descriptions and store-first details

lib/discover.js retains bounded full Steam/GOG/Xbox description content and collapses whitespace in summaries. app/rich-description.js creates passive allowlisted DOM nodes from an inert template; it caps content size, node depth/count, text and inline images. Only approved HTTPS image hosts are accepted. Source styles/dimensions, event attributes, scripts, frames, forms and arbitrary image sources are dropped. app/discover.js moves store choices directly below the title, keeps the bottom screenshot gallery, and resets newly opened dialogs to the top; app/discover.css normalizes rich content spacing and responsive images. app/index.html loads the renderer; package files advance to 0.5.5.

36 unit tests pass. output/check-description.cjs verifies a malicious-markup fixture creates no active elements/attributes or foreign image requests, then uses live Fallout 4 GOTY store metadata to verify its inline review artwork, 3778 characters of untruncated description, store choices preceding description, all four gallery images, and no dialog overflow at 1440/800/390px. Evidence: output/description-results.json and output/playwright/description-*.png.

Final artifact is 0.5.6 because the earlier 0.5.5 portable was already open. Untranslated GOG product_feature placeholders are filtered during passive DOM construction. The existing application remains open; only the waiting builder was stopped.

## 0.6.0 category facets, Free-2-Play and Library controls

lib/discover.js adds Shooters, section/category/query cache keys with legacy-cache migration, section-aware source queries, Steam batch metadata/current artwork, and verified free eligibility. lib/epic-discover.js distinguishes permanently free base games from promotions. app/discover.js and app/discover.css keep the large category grid above results, add compact category buttons to each requested section, retain query/section intersections, and leave Explore without category controls. app/index.html adds Free-2-Play and the filter containers. lib/library-preferences.js, main.js, preload.js and app/app.js persist independent Library store choices and prioritize favorites within Installed/Owned sort groups. app/styles.css styles the Library toggles; package files advance to 0.6.0.

39 unit tests pass, including section/category source query composition, cache isolation, explicit free metadata versus promotional/unknown prices, modern Steam asset paths and Library preference validation. output/check-browse-controls.cjs passes native tests for 26 categories, same-page results under the category grid, category hot swapping, Top sellers + Adventure, search preserving tab/category, verified Free-2-Play + Shooters, compact filters in every requested section, unchanged Explore controls, independent/persistent Library toggles, favorites-first ordering in all sort modes and grid/list, empty-filter recovery, and 1440/800/390px containment. Evidence: output/browse-controls-results.json and output/playwright/{categories-with-results,top-adventure,free-shooters,library-store-favorites}.png.

Steam filtered-result metadata also verifies Windows compatibility and release status, so upcoming free games are not treated as currently playable. Batch lookups are capped at 48 search rows. Native source regression checks passed both the broader Discover workflow and the installed-library runtime workflow.

## 0.6.1 repository and desktop CI

A source-only private GitHub repository is initialized at M2AF/The-Nexus. Runtime assets, source, lockfile, unit tests and documentation are tracked; local output, binaries, caches, credentials, databases and raw logo/video exports are ignored. .github/workflows/build.yml builds Windows portable EXE and Linux x64 AppImage with pinned official actions, Node 24, checks/tests, archive-content validation, checksums, packaged UI/IPC smoke tests and downloadable artifacts. Matching version tags prepare a draft release after both OS jobs pass; no release is published automatically.

Linux changes support executable-permission validation for manually selected native binaries/AppImages, preserve case-sensitive game paths, detect Flatpak Steam, and resolve registered Linux store protocols. Windows behavior stays platform-specific. scripts/smoke-packaged.cjs uses a synthetic isolated library and no account/store requests. scripts/verify-artifact.cjs checks packaged file roots and excludes personal data before producing a checksum/build manifest. Local Windows checks pass 40 tests with one POSIX-only test skipped; Linux validation runs on the hosted runner.

## 0.6.2 frameless window and portal themes (local)

The native frame/title-bar overlay and separate renderer title row are removed. The existing header supplies an Electron drag region with interactive controls excluded; fullscreen, maximize/restore, minimize and close use validated IPC actions. Portal themes persist validated hex RGBA colors in the existing local library settings. Shared palette math composites opacity, derives surfaces and chooses text with at least 4.5:1 contrast for its semantic roles. The embedded HSV picker supports hex input, hue, saturation, brightness, opacity, optional screen sampling, live preview, save, reset and discarded unsaved previews. Logo settings remain separate. Controller horizontal D-pad input adjusts focused ranges; cursor activation sets their position.

43 unit tests pass with one POSIX-only skip on Windows. output/check-theme.cjs verifies source-app startup, absence of the title row, drag/no-drag CSS, fullscreen/F11, maximize/restore, live themes, persistence across restart, invalid input, keyboard and virtual-controller sliders, reset and dialog containment at 1440/800/390px. Screenshots in output/theme-*.png were reviewed for light and dark palettes. The packaged smoke check also exercises theme persistence/reset and title-row removal. These are local checks; no 0.6.2 release has been published.

The updated Windows app also passes the detailed theme/window checks from dist/win-unpacked. output/audit-theme.cjs finds no low-contrast text in its light Library, Settings and signed-out Friends scenarios (artwork/hero overlays and disabled controls excluded). output/check-drag.cjs queries native Windows WM_NCHITTEST: the empty header returns HTCAPTION and the close button returns HTCLIENT; minimize and restore also pass.

Follow-up: the top header uses exactly the page background and has no bottom divider. Its drag region and compact controls remain intact. The theme/window check asserts matching computed header/body colors for both default and custom themes.

Settings-close regression reproduced through native Windows hit testing: the close button initially returned HTCAPTION (2) because its screen position overlapped the underlying header drag region, despite passing synthetic renderer clicks. Disabling header dragging whenever any dialog is open and marking dialog contents no-drag changes the button to HTCLIENT (1). The native check confirms closing Settings, and the packaged smoke check asserts no-drag during Settings and restored dragging afterwards.

## 0.6.3 unified contextual search (local)

The sidebar branding text, Library intro, breadcrumb/status label, Discover eyebrow/tagline and both old search locations are removed. app/search.js coordinates one header form with independent Library/Discover drafts and dynamic Search Library/Search Stores labels. Library filtering remains live; Discover submits through its existing catalog loader with category, section, region and store choices retained. Existing logo/home navigation resets only the Library query. Scan library moves beside Library connections; Discover region remains with Refresh catalog. The existing More worlds. More choice. title remains.

output/check-search.cjs passes Library filtering and submission, isolated Discover submission through fixture IPC, tab/category preservation, independent query restoration, home reset, slash shortcut, one search landmark, removed markup, no renderer errors, and header containment at 800/390px. Screenshots search-library.png, search-discover.png and search-{800,390}.png were reviewed. Source theme/window checks also pass. No 0.6.3 release is published.

The 0.6.3 Windows packaged payload passes unified search checks, the existing theme/window suite, native header/search/modal hit testing, and the expanded packaged smoke check. Native shared-search hits return HTCLIENT; blank header returns HTCAPTION outside dialogs and HTCLIENT while Settings is open. Unit checks remain 43 passed with one POSIX-only skip.


## 0.8.0 linked accounts preview

Top toolbar Accounts opens a dedicated ChainLens anchor and separate platform connections. Discord wins merged profile/avatar and default messaging selection, then Steam; ChainLens remains a messaging fallback. Only verified stable server identities auto-group contacts; manual separation persists and overrides auto grouping. Xbox and Epic read-only friend adapters consume one-time sessions in Electron main, keep credentials in encrypted storage, and expose no token through preload. Xbox/Epic Message controls remain disabled until supported native messaging exists. Epic REST friends cover accounts consenting to this application; Epic presence is unknown.

Local validation: 57 tests (56 pass, one POSIX skip on Windows), syntax checks and Electron synthetic account workflows, verified-link grouping, contact overrides, route priority, Open chats, readonly platform controls and native Discord offline startup. Backend has 307 passing tests and an unapplied private migration. Live Xbox/Epic consent, platform API entitlement, Epic brand review, and backend activation are separate gates. No real messages were sent.


Live account-link activation on November 11: ChainLens commit24c36f3603a2910a83b527f1a3369ab6630ed9b2 is deployed on Render with four private app client values verified. Migration20261111064353 is applied, with browser-role access denied and service CRUD/function access verified. Read-only live verification using the existing Nexus session confirms all four provider flags enabled and accepted-friend identity edges available. Unauthorized identity/session APIs return401; invalid Steam/Xbox/Epic callbacks return400. Evidence output/accounts/live-activation.json and render-account-linking-live.png. Actual Xbox/Epic OAuth/API entitlement and Epic public brand review remain separate gates. No agent messages or friend links were written.


Epic callback repair on November 11: a direct invalid-code probe identified invalid_client_credentials from the incorrectly saved app secret. User corrected the existing secret in Render; ignored local .env was synchronized privately. Backend06d3f9fccf5080ae745b5ef636dfdd70d95610d8 is Live with308 passing tests and distinct configuration/expired-code messages. Official token endpoint and the deployed authenticated callback now accept app credentials and reject a deliberately invalid code as invalid_grant. No real Epic identity link or message was written by these probes. User must start fresh Epic browser consent; this verifies client configuration, not a completed real-account OAuth or full public Epic availability. Evidence output/accounts/epic-credential-check.json, epic-live-fix-check.json and epic-fix-render-live.png.

## 0.8.1 Epic consent and Xbox throttling repair

ChainLens commit 8cff04c98256e4cb95151c93288542390b369f9d is Live on Render. A real Epic authorization-code flow reproduced corrective_action_required/SCOPE_CONSENT: the registered application requires Presence while the request omitted it. Both authorization and token requests now include basic_profile, friends_list, and presence; explicit consent is shown. Real callback succeeded and the one-time desktop session was claimed into encrypted local storage. Epic account display-name lookup succeeds; the application-authorized friends list currently returns zero. Public Epic brand review and broader friend coverage remain separate. No messages were sent.

Xbox live adapter reads the own gamertag and 96 friends with presence even when profile enrichment returns HTTP429. Profile lookups are cached for ten minutes and batch at most100 IDs; Retry-After cooldown applies per service, and profile failure no longer discards the whole roster. Remaining profile names/pictures may fill after throttling clears. Regression coverage verifies cooldown, recovery, caching, gamertag independence, token privacy, and stale-session isolation. Source checks and59 unit tests pass (58 passed, one POSIX skip); synthetic platform workflows pass. Backend check and all308 tests pass. Windows packaging and packaged checks recorded below after completion.

Windows0.8.1 portable build completed. Fresh packaged platform workflows and packaged startup/renderer/IPC/settings smoke pass; artifact allowlist, production dependency pinning, native SDK resource matching and personal-data exclusion pass. Reviewed packaged friends-first screenshot and real Epic callback confirmation screenshot. Executable: dist/The-Nexus-0.8.1-portable.exe. No Nexus GitHub release was published during this repair.

## 0.8.2 Xbox friend names and pictures

Replaced the normal Xbox friend path with Microsoft's Social Manager PeopleHub graph endpoint (contract7), which supplies gamertags, pictures and presence in one read. Primary implementation reference: https://github.com/microsoft/xbox-live-api/blob/main/Source/Services/Social/Manager/peoplehub_service.cpp. Legacy social/profile calls remain an account-compatibility fallback. The graph returns current friends rather than the legacy one-way following roster.

Real saved-account read: HTTP200,81 current friends,81 real names,81 pictures, own gamertag present, no error; only one PeopleHub request. Evidence: output/accounts/xbox-adapter-live-check.json and xbox-peoplehub-live.json. No messages or relationship changes. Profile names and pictures now persist in the existing encrypted platform session, bounded and scoped to the Xbox owner; stale cached names survive a temporary profile failure. Unfriended entries are filtered by the current roster. Cache from a different owner is ignored. Tests cover one-call graph loading, modern gamertag suffixes, presence titles with hyphens, duplicate/nonfriend filtering, restart/offline cache retention and account isolation. Syntax checks,60 unit tests (59pass, one POSIX skip), and source platform workflow smoke pass. Portable build is in progress; packaged checks follow below.

Windows0.8.2 build completed. Final packaged adapter bytes match source; packaged account/friends/chat UI workflows and startup/renderer/IPC/settings checks pass. Artifact allowlist, native resource matching and personal-data exclusion checks pass; SHA256 generated beside the executable. No GitHub release or backend changes during this fix. Executable: dist/The-Nexus-0.8.2-portable.exe.

## 0.8.3 friend invitations and current-game picker

Friends support right-click or Shift+F10 actions for each linked Steam/Discord/Xbox/Epic account. The invitation dialog shows a preview and requires an explicit send/copy action. Steam native game-invite cards use fresh self activity and rich-presence connect data; a changed game, absent/unsafe join data, disconnected/nonfriend recipient or rejected acknowledgement fails closed. Ordinary Steam/Discord invitation messages and clearly labelled manual copy fallbacks for Xbox/Epic are available. Xbox/Epic DM APIs are not implemented. Native invite protocol construction and acknowledgement handling are tested with stubs; real recipient delivery/join was not tested and no real invitation/message was sent.

The picker now displays only the detected running installed game and labels it Currently playing; when no current game is detected it lists installed games only, excluding owned-only and web titles. Windows detection uses visible process executable paths matched against installed directories/executables and a lightweight foreground PID tracker. The last foreground game is preferred; last launch history never establishes that a game is running. Linux supports native /proc executable paths; Proton-specific detection and device validation remain separate. Sending an arbitrary owned-only library key is also rejected in Electron main. Sender identity is bound to the preview owner and rechecked before sending.

Source syntax checks pass.64 tests:63 pass, one POSIX skip on Windows. Expanded Electron UI smoke covers right click, Shift+F10, merged-platform selection, explicit native/message/copy actions, no send on opening the menu, running-game-only versus installed picker, and Xbox/Epic copy-only presentation. Windows native foreground APIs and visible-process enumeration loaded successfully. Screenshots output/platforms/invite-{steam,current,xbox,epic}.png reviewed. Windows portable build in progress; packaged results follow below.

Windows0.8.3 portable completed. Final packaged invitation/current-process sources match source byte-for-byte; expanded packaged platform UI and startup/renderer/IPC/settings smoke pass. Artifact allowlist, SDK matching, personal-data exclusion and SHA256 generation pass. Executable: dist/The-Nexus-0.8.3-portable.exe. No GitHub release or backend deployment performed for this change.

## November 11: ROB RUN live invite investigation (not completed)

User confirmed ROB RUN's own party invite was received and accepted by kbunny_99 after both players were in a location accepting invites. This is a game-originated baseline, not a Nexus delivery test. No Nexus invite or invitation message was sent during this investigation.

With Nexus closed, a short Steam CM probe without a persona change timed out reading self persona. A bounded Invisible/web-chat-mode probe without web cookies returned self persona but no current app/join data; it logged off immediately. User confirmed ROB RUN still showed the friend online afterwards. This does not establish long-running CM coexistence or identify the earlier conflict's root cause.

A separate read-only local Steam API probe loaded the installed, Authenticode-valid Valve steamclient64.dll, created/released its own IPC pipe and global-user handle, and used versioned SteamClient023/SteamFriends018 interfaces. It did not log in, change persona, inject into the game, or send anything. It read 24 friends and GetFriendGamePlayed(self) returned app 4262460 (ROB RUN), with no Steam lobby ID. The connect rich-presence key was empty. Rich presence is application-scoped, so the empty key alone is not proof that the game never supports external joining. Its previous Unity log shows EOS room activity; this is not proof of the party-invite transport.

Blocker: no validated join target or documented ROB RUN external party-invite API has been obtained. Do not substitute the game's player ID for a Steam lobby/connect string, invent a join command, or label a text invitation as a real invite. The raw BBCode Steam-card path remains stub-tested only. The user and friend also own RuneScape: Dragonwilds but are continuing ROB RUN; a different-game end-to-end test is deferred. Diagnostic scripts and downloaded header references are ignored under output/accounts, not app/package resources. No new package or release was built for these probes.

## 0.8.4: Dragonwilds real Steam lobby invitation

On November 11 the running Dragonwilds session (Steam app1374490) exposed a Steam lobby ID through the signed local Valve client. The direct ISteamMatchmaking call from Nexus's non-game IPC context returned false. Nexus then sent exactly one Valve ClientMMSInviteToLobby protobuf (EMsg6621) using a short, invisible Steam CM session, with the actual own lobby, current friend ID and matching authenticated sender. The user confirmed kbunny_99 received the Steam game invitation and Steam's friends list still worked. Receipt is confirmed; accepting/joining was deliberately not tested. No text invitation fallback was sent.

The right-click native action now prefers that verified lobby path. Local reading runs in a separate Electron utility process using exact SteamClient023/SteamUser023/SteamFriends018 interfaces; the existing installed DLL must pass Windows Authenticode verification with Valve as publisher. No Valve DLL is copied or bundled, no foreign app ID is assigned to Nexus, and no game process is modified. The private lobby stays in Electron main/utility process. Both local and network account IDs, fresh game/lobby and current friendship are rechecked before sending. Payload enqueueing is presented as Submitted, not delivered or joined.

Steam startup now uses invisible web-chat UI mode and defers web-cookie authentication until achievements are explicitly requested. This matches the successful short-session test; longer coexistence validation remains a separate check. ROB RUN exposes no Steam lobby in the tested session and its in-game party invite is not a Nexus Steam integration. Linux has no local lobby reader yet; its existing rich-presence path remains separately unverified with a recipient.

Syntax validation and67 unit tests pass (66 passed, one POSIX skip on Windows), including correct lobby protobuf fields, fresh-session checks, stranger/account/game rejection and no chat fallback. The signed-library utility-process read succeeds against the live Dragonwilds lobby. Synthetic Electron social/invite workflows pass with the new Submitted wording. Full native UI and packaged results follow when completed.

The user then used the actual updated Nexus friends UI: right-clicked the merged friend, chose Invite via Steam, and pressed Send Steam game invite. They reported it worked. CUA observed the real preview targeted kbunny_99, selected only RuneScape: Dragonwilds (Currently playing) · Joinable Steam session, and displayed Steam lobby invitation submitted. The first recipient-confirmed diagnostic and the subsequent user-driven UI send are distinct attempts. No game join was tested. Long-running general Steam coexistence is not claimed from these tests.

Windows0.8.4 portable build completed and is available at dist/The-Nexus-0.8.4-portable.exe (121,900,557 bytes). The build's initial resource writes encountered a transient external executable lock; a scoped EBUSY retry in an ignored build wrapper completed without disabling any security software. Output was staged in dist/0.8.4 to preserve previous files, then the final executable was copied to dist. Packaged startup/renderer/IPC/settings smoke and the expanded synthetic social/invitation smoke pass. A separate packaged native-reader check reads the live Dragonwilds lobby successfully without logging in or sending another invite. Packaged main/invitation/native-reader/process-detection sources match source byte-for-byte. Artifact allowlist, private-data exclusion, matching SDK resources and SHA256 checks pass. Joining, Linux lobby invites, and a broad game compatibility matrix are not claimed. No GitHub release or backend deployment performed.

## November 11: Xbox/Forza invite access gate

Forza Horizon6 (installed MicrosoftGame.config TitleId7bf69384 / decimal2079757188) is running. User confirmed an Xbox Game Bar invite was received by another player; joining was not tested. Agent sends remain limited to the earlier-approved PvtSmokeyKBunny target, and no Xbox invitation was sent by Nexus or the agent.

Read-only own-account diagnostic requests using Nexus's existing encrypted Xbox session returned: MPSD handles/query?include=relatedInfo, contract107, HTTP403 / "The requested service config cannot be accessed."; Multiplayer Activity title-specific own activity, contract1, HTTP401 AuthenticationError / "Missing title Id claim."; dashboard activity query for the own account only, HTTP401 with the same missing-title claim. No title IDs/client identities were spoofed, no Xbox/Game Bar tokens were extracted, and no authentication or production settings were changed. Diagnostic outputs redact session references, own IDs and credentials.

ChainLens nexus-identities.js was inspected read-only: consumer XboxLive.signin OAuth, user.auth.xboxlive.com RPS user auth, then xsts.authorize with SandboxId RETAIL and UserTokens. No TitleToken or device authentication is implemented. The Microsoft sign-in registration is distinct from an Xbox-services title identity. Adding a Nexus title does not prove authorization to manage Forza or other third-party title sessions. Blocker is obtaining an approved authentication/access path and verifying cross-title session permission before implementing a real send action. Do not represent Game Bar automation, copied text, a native in-game invite, or a hypothetical GDK integration as a working Nexus Xbox invite.

Evidence: output/accounts/xbox-invite-access-check.json and ignored read-only probe scripts. No app code, backend deployment or release changed for this investigation. The0.8.4 Steam invite build remains the latest verified artifact.

Partner Center was inspected read-only on November11: signed-in Apps and games overview showed0products; new-product menu offers ordinary EXE/MSI apps and GDK games as distinct categories. No Nexus Xbox-services identity was found in that selected account. No product/terms/permission/backend mutation was performed. docs/XBOX-INTEGRATION.md records the findings, the distinction between user-only and title authentication, the unproven cross-title access question, primary references and an unsent Microsoft support-request draft. Evidence screenshot output/accounts/xbox-partner-products.png. Further direct-invite work requires an approved authentication/access path; creating an unrelated game/title registration must not be claimed to unlock third-party game sessions.

## 0.9.0 local Steam + tray baseline

- 75 unit tests: 74 pass, one POSIX host skip; static checks pass.
- Corrected Windows package under dist/0.9.0-final passes startup/settings/IPC smoke and synthetic social/overlay/tray/chat-handoff smoke.
- dist/The-Nexus-0.9.0-portable.exe is copied from that corrected build; verify:artifact passes allowlist/privacy/SDK-resource checks and generates SHA-256.
- Live local Steam reader sees kbunny_99 in the same app as the owner, including real avatars; no extra Steam login is used.
- Final real UI check was interrupted by physical Escape; no real invitations or messages were sent. Native local invite path still needs a new receipt-confirmed test.
- User confirms the floating overlay takes the game out of foreground and wants a true in-game overlay. 0.9.0 does not satisfy that newer requirement. See docs/GAME-OVERLAY-ARCHITECTURE.md; implementation route awaits user choice.

## Independent native overlay prototype (not released)

- User selected an independent Nexus renderer, with no Game Bar/Steam overlay host.
- Earlier D3D12 fixture GPU readback/input-release test and complete sandboxed offscreen friends UI test pass; screenshot in output/native-overlay/friends-ui.png.
- Later native source revisions compile, but Microsoft Defender blocks NexusOverlayTest.exe as Behavior:Win32/DefenseEvasion.A!ml. Native execution tests stop at that concrete block. Protection remains enabled; no exclusion/restore/bypass is attempted.
- No injection into RuneScape or another user game is attempted. No new native-enabled executable is packaged or published. The source path is development-only and not enabled by default.
- Static/JavaScript checks continue independently; latest native reconnect and runtime input guards require retest after security review.


## Steam desktop chat investigation (2026-11-11)

- The 0.9.1 candidate failed user-coordinated incoming Steam message delivery. Steam itself received the message; the local pipe reported unread348/presence336 but no chat343 callback. Listener setup always returning true was incorrectly treated as chat capability.
- Default source now keeps the unverified listener disabled and reports local chat unavailable. Existing desktop Steam friends/presence/invites remain separate. No extra network login/persona change, token extraction, agent message send or native overlay execution occurred.
- `npm run check` passes. `npm test`:82 total,81 pass,one POSIX host skip. A regression verifies unavailable local chat retains friends and rejects in-client sends before transport access. These are source/unit checks, not live chat success.
- SteamFriends002 is present and its identity/friend count are consistent with the desktop session. A bounded read-only GetChatMessage probe returns one type1 cache entry. The user manually sent the agreed outgoing marker; it was not found in the buffer. The user confirmed the named incoming marker arrived in Steam; the legacy buffer did not contain it and still returned one cached entry. This fails to establish current delivery, usable history or sender identity. Do not integrate this legacy reader based on the cache-read probe.
- No new packaged artifact or release is validated/promoted; dist/0.9.1-chat remains a failed test candidate. Native overlay Defender restrictions remain in force.


## Restored account-backed Steam chat (2026-11-11, user-authorized)

The user authorized returning to the earlier separate Steam chat session to prioritize working messages inside Nexus while native overlay development remains separate. main.js now uses SteamSocial again. Connected Steam accounts/friends explicitly advertise Message; history has real sender IDs and timestamps, sends go through steam-user, and stale history responses are rejected. The rejected desktop-only listener remains inactive.

- Source syntax checks pass.84 unit tests:83pass,one POSIX host skip. Added regressions cover migration from desktop-only preferences, in-client messaging capabilities, incoming/outgoing authorship, NUL rejection and stale history after disconnect.
- Source synthetic social smoke passes. Fresh unpacked Windows candidate passes startup/settings/IPC and synthetic friends/chat/overlay/tray/install UI checks. Fixtures are not live delivery.
- Fresh portable build completed under dist/0.9.1-steam-chat and root dist/The-Nexus-0.9.1-portable.exe; package privacy/allowlist/SDK checks pass, SHA25678308e7857579e1cab62bed84e32cb5cfe6bfd892c121fdcade2a124359d1728. Its unpacked app is open with Steam Guard QR requested; awaiting user approval and read-only conversation-history verification. No messages sent by agent. No GitHub release published. Native Nexus overlay is not executed.


Restored chat live result: user confirms Steam Guard sign-in, Steam friends appearing, and messages visible inside Nexus. This is user-observed in-app history/display confirmation. No agent message was sent, and fresh outgoing recipient receipt or desktop Steam status are not claimed. Read-only observer60555 completed; no further live test is pending.


## Battle.net integration0.9.2 (2026-11-12)

- Battle.net added to Library/Discover, above itch.io in sidebar and Library toggles. Existing saved selections migrate once. Local installation scanner reads Agent product.db, registry uninstall records and moved-folder active .build.info entries; known game executable required. Galaxy/JSON owned imports normalize Battle.net IDs and provide official art. Launch/install/store plans use whitelisted product mappings; store pages do not launch games.
- Source check passes;89unit tests:88pass,one POSIX host skip. New tests cover bounded/corrupt protobuf data, launcher/beta rejection, moved installs/missing executables, PC base-game catalog parsing, asset-host validation, imports, exact cross-store merging, preference migration, free filters and client/website routing.
- Live Blizzard public page yields13supportedPC games;13/13official artwork URLs return200 image responses. Five titles have verified free-to-play metadata. Paid prices, release-date/new-arrival charts, sales and top-seller ranks are not fabricated. Direct Battle.net account-entitlement sync is not included; owned metadata imports use Galaxy or JSON.
- Source and packaged dedicated Battle.net UI smoke passes: migrated filters, sidebar order,13live-public cards/art, ownership badges, client store-button plan and five Free-2-Play results. Screenshots inspected under output/battlenet. Store/launch IPC is stubbed: no real game launch, installation, purchase or account action is performed by these tests.
- Packaged Windows startup/settings/IPC and existing social/chat/overlay/tray/install UI smoke also pass. Native overlay is unchanged and unexecuted. Restored account-backed Steam chat remains in use.
- Live read-only PC check detects the installed Battle.net client; zero supported games currently found. Actual Battle.net game launching and download completion remain untested on this PC. Use Scan library after a game finishes installing; byte/percentage progress is not available.
- Windows portable: dist/The-Nexus-0.9.2-portable.exe,121904220bytes. Privacy/allowlist/SDK checks pass. SHA25663aa2510914b82599e6fa5dfc75479d3e184a053b9e60586b351f88ff5cc244c. Matching unpacked build:dist/0.9.2-battlenet/win-unpacked. No GitHub release, commit or push performed.
