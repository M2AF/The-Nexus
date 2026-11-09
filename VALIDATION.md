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
