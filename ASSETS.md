# Asset sources

- ChainLens mark: existing `public/chainlens_icon_dark.png` from the user's ChainLens project, copied unchanged to `app/assets/chainlens.png`. Social controls use the existing Lucide icon set; emoji use the operating system's Unicode rendering. GIFs are selected from GIPHY with attribution and belong to their respective owners.

- Nexus branding: user-provided `Logos/The_Nexus_logo2.png`. App assets are size variants that preserve the supplied image and transparency. The original is unchanged.
- Controller glove: original code-native SVG in app/controller.js, with a P1 badge styled in app/controller.css.
- Interface SVGs: Lucide Static 1.70.0, https://lucide.dev/ (ISC; license included in app/assets/icons/LICENSE-lucide.txt).
- Steam, GOG, Epic and itch.io logos: Simple Icons 16.36.0, https://simpleicons.org/ (CC0).
- Xbox logo: Simple Icons 11.15.0, https://raw.githubusercontent.com/simple-icons/simple-icons/11.15.0/icons/xbox.svg (CC0; archived icon).
- Game covers and banners: local Steam library cache (including modern hash directories), downloads from Steam's Cloudflare/Fastly CDN, and GOG's public product API with images from gog-statics.com. Downloaded artwork stays in the app's local data directory. Game imagery belongs to its respective rights holders. Unavailable covers retain a title card; game details allow selecting a PNG/JPEG manually.
- Xbox installed artwork comes from each game's own package manifest/assets. Owned-library artwork URLs are read from Galaxy's existing originalImages records and restricted to approved Steam/GOG image hosts.

SVG platform colors are adjusted for contrast. Game/platform marks identify their respective games/services; no endorsement is implied.

- Wavedash mark: official favicon SVG from https://wavedash.com/favicon.svg, copied without alteration.
- itch.io game covers: approved img.itch.zone / img.itch.io image URLs already in its local library database.
- Wavedash covers and title metadata: public game cards on https://wavedash.com/ and game-page metadata, with artwork served by uploads.wavedash.com. Public featured titles are not ownership records.
- itch.io launch/install routes follow the official app documentation: https://itch.io/docs/itch/integrating/protocol-urls.html. Wavedash browser-platform behavior is described at https://docs.wavedash.com/getting-started/introduction.

- ChainLens sign-in wordmark: user-selected `public/logos/ChainLens (dark).png`, copied unchanged to `app/assets/chainlens-wordmark.png`; display crops transparent padding through CSS. Compact header/toolbar marks retain the icon.

- Discover game art, screenshots, descriptions and release/price data: public Steam Store storefront endpoints (store.steampowered.com), GOG catalog/product endpoints (catalog.gog.com and api.gog.com), Xbox's public PC catalog pages (xbox.com) and Microsoft Display Catalog (displaycatalog.mp.microsoft.com). Steam images also use shared.akamai.steamstatic.com; Xbox imagery uses store-images.s-microsoft.com and store-images.microsoft.com. Images belong to the respective rights holders and identify actual store listings.
- Discover compass: Lucide Static, existing ISC license. Category tiles use existing store artwork only when genre metadata matches, otherwise CSS backgrounds. No generated game artwork or fabricated reviews are used.

- Logo color variants: user-provided Logos/animated_no-bg.webp, Logos/orange logo.png and Logos/pink logo.png. 512px full-color transparent PNG display textures are rendered through Electron; original source exports are preserved.
- Animated logo: background and wordmark groups from the user-provided Logos/animated_no-bg.svg, rendered separately with RGBA transparency. Code-native CSS rotates only the background 360° at constant speed in a seamless ten-second loop. No AI redraw, GIF quantization or MP4 chroma-keying is used. The full-resolution SVG companion retains the original embedded source artwork.
- Canva provenance: user's 1:1 Logos design, https://www.canva.com/d/u2ZTQ0rkalCPWn6; inspected with the Canva connector to confirm separate imagery and lettering. The read-only draft was cancelled; the design was not changed.

- Orange and pink animated orb textures: native SVG color-matrix derivatives fitted to the supplied matching color exports. Background palette is approximated (mean channel deviations 5/255 orange and 4.4/255 pink); original transparent wordmark is shared unchanged.

- Windows icon (0.5.1): current supplied blue/cyan logo converted into 16, 20, 24, 32, 40, 48, 64, 128 and 256px ICO entries; full RGBA PNG retained for the window.

- Epic Discover: public PC promotional metadata from https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions with regional parameters; official image hosts cdn1.epicgames.com and cdn2.unrealengine.com. The existing official Epic SVG is reused.

- Inline game-description media: approved store CDN URLs in the source description (including items.gog.com). Media loads directly from its original store host; original PNG/JPEG/GIF formatting is retained. No additional artwork is packaged.

- Filtered Steam Discover cards use official Steam Store Browse batch asset metadata, including current hashed capsule/header/library paths under shared.fastly.steamstatic.com/store_item_assets. Existing platform logos are reused for Library store toggles.

Battle.net platform logo: Simple Icons battledotnet.svg (CC0), tinted Battle.net blue. Blizzard game images are official Blizzard CDN images referenced from https://www.blizzard.com/en-us/games/; their rights remain with their respective owners. Metadata source checked November12,2026. lib/battlenet-products.json keeps the supported PC product mappings and replaceable artwork URLs.
