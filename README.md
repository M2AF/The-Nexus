# The Nexus

A standalone Windows game launcher adapted from DesktopX. DesktopX and Agent Office are unchanged.

## Run

Open `dist/The-Nexus-0.5.0-portable.exe`, or use `npm install` and `npm start` from this folder. Close an older Nexus window before opening the new executable. Older library records refresh automatically while preserving favorites, launch history, manually added games and artwork overrides.

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

Export is a readable metadata backup, not a complete state restore. To restore full local state, close Nexus and restore its original library.json and artwork directory from a filesystem backup. This version has no direct platform sign-in flows, cloud saves, achievements, game updates or DRM replacement.

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
