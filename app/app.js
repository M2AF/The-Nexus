const $ = id => document.getElementById(id);
const providers = { steam: 'Steam', xbox: 'Xbox', gog: 'GOG', epic: 'Epic Games', battlenet:'Battle.net',itch:'itch.io',wavedash:'Wavedash', custom: 'Local games' };
let state = { games: [], favorites: [], history: {}, lastScan: null };
let view = 'all', provider = 'all', query = '', shelf='installed', visibleLimit=60, selected, busy = false, toastTimer;
let libraryStores=Object.keys(providers);
const api = window.nexus;
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function icon(name) { const img = node('img', 'ui-icon'); img.src = `assets/icons/${name}.svg`; img.alt = ''; img.setAttribute('aria-hidden', 'true'); return img; }
function buttonIcon(id, name, label) { $(id).replaceChildren(icon(name), node('span', '', label)); }
function toast(message, error = false) { $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 9000 : 4500); }
async function call(method, ...args) {
  if (!api) { toast('Open The Nexus desktop app to scan and launch your games.', true); return null; }
  try { const result = await api[method](...args); if (result?.error) throw new Error(result.error); return result; }
  catch (error) { toast(error.message, true); return null; }
}
function apply(result) { if (result?.games) { state = result;libraryStores=Array.isArray(result.libraryStores)?result.libraryStores.filter(id=>Object.hasOwn(providers,id)):Object.keys(providers);render(); document.dispatchEvent(new Event('nexus-library-updated')); } }
function art(game, portrait = false) {
  const value = portrait ? game.portrait || game.header : game.header || game.portrait;
  if (/^data:image\/(jpeg|png);base64,[a-z0-9+/=]+$/i.test(value || '')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && (['blz-contentstack-images.akamaized.net','bnetproduct-a.akamaihd.net','blzmedia-a.akamaihd.net','bnetcmsus-a.akamaihd.net','cdn.cloudflare.steamstatic.com','shared.fastly.steamstatic.com','images.gog.com','img.itch.zone','img.itch.io','uploads.wavedash.com'].includes(url.hostname)||/^(images|images-\d)\.gog-statics\.com$/.test(url.hostname)) ? url.href : null; } catch { return null; }
}
function image(game, portrait = false) {
  const src = art(game, portrait); if (!src) return null;
  const img = node('img'); img.src = src; img.alt = ''; img.loading = 'lazy';
  const fallback = art(game,!portrait); let retried = false;
  img.addEventListener('error', () => { if (!retried && fallback && fallback !== src) { retried = true; img.src = fallback; } else img.remove(); });
  return img;
}
function date(value) { return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Never'; }
function heroGame() {
  const eligible=state.games.filter(game=>libraryStores.includes(game.provider)&&(provider==='all'||game.provider===provider));
  const installed=eligible.filter(game=>shelf==='web'?game.web:game.installed);
  const recent = [...installed].sort((a, b) => (state.history[b.key]?.lastLaunched || '').localeCompare(state.history[a.key]?.lastLaunched || ''));
  return recent.find(g => state.history[g.key]) || installed.find(g => state.favorites.includes(g.key)) || installed[0] || eligible[0];
}
function renderHero() {
  const game = heroGame(); $('hero-art').replaceChildren();
  $('hero-details').hidden = !game;
  document.querySelector('.hero-orbit').hidden = Boolean(game && art(game));
  if (game) {
    const img = image(game); if (img) $('hero-art').append(img);
    $('hero-tag').textContent = state.history[game.key] ? 'JUMP BACK IN' : 'READY WHEN YOU ARE';
    $('hero-name').textContent = game.name;
    $('hero-description').textContent = `${providers[game.provider] || game.provider} · ${game.web?'Browser game':game.installed?'Installed in your library':'Not installed'}${state.history[game.key] ? ` · Last launched ${date(state.history[game.key].lastLaunched)}` : ''}`;
    buttonIcon('hero-play', game.installed||game.web?'play':'download', game.web?'Play in browser':game.installed?'Play now':clientLabel(game));
    $('hero-play').onclick = () => launch(game);
    $('hero-details').onclick = () => details(game);
  } else {
    $('hero-tag').textContent = 'WELCOME TO YOUR NEXUS'; $('hero-name').replaceChildren(node('span', '', 'Less searching.'), node('br'), node('span', '', 'More playing.'));
    $('hero-description').textContent = 'Bring your installed games together. Your next session starts here.';
    buttonIcon('hero-play', 'refresh-cw', 'Discover my games'); $('hero-play').onclick = scan;
  }
}
function inShelf(game){return shelf==='web'?game.web:shelf==='installed'?game.installed:game.owned;}
function filtered() {
  const games = state.games.filter(g => inShelf(g) && libraryStores.includes(g.provider) && (provider === 'all' || g.provider === provider) && (view !== 'favorites' || state.favorites.includes(g.key)) && (view !== 'recent' || state.history[g.key]) && g.name.toLowerCase().includes(query));
  const sort = $('sort').value;
  return games.sort((a, b) => {
    if(shelf!=='web'&&view!=='recent'){const priority=Number(state.favorites.includes(b.key))-Number(state.favorites.includes(a.key));if(priority)return priority;}
    if (sort === 'recent' || (view === 'recent' && sort === 'name')) return (state.history[b.key]?.lastLaunched || '').localeCompare(state.history[a.key]?.lastLaunched || '') || a.name.localeCompare(b.name);
    if (sort === 'provider') return a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name);
    if (sort === 'size') return Number(b.sizeGb || 0) - Number(a.sizeGb || 0) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });
}
function render() {
  const focused=document.activeElement.closest?.('[data-game-key]');
  const focusKey=focused?.dataset.gameKey,focusAction=document.activeElement.dataset?.action;
  const games = filtered();
  $('library-stores').replaceChildren(...Object.entries(providers).map(([id,label])=>{const button=node('button','library-store-toggle');button.dataset.libraryStore=id;button.setAttribute('aria-label','Show '+label+' in Library');button.setAttribute('aria-pressed',String(libraryStores.includes(id)));const mark=node('img','platform-logo');mark.src=id==='custom'?'assets/icons/gamepad-2.svg':`assets/platforms/${id}.svg`;mark.alt='';button.append(mark,node('span','',label));button.onclick=async()=>{document.querySelectorAll('.library-store-toggle').forEach(control=>control.disabled=true);const next=libraryStores.includes(id)?libraryStores.filter(store=>store!==id):[...libraryStores,id];const result=await call('libraryStores',next);if(result?.stores){libraryStores=result.stores;state.libraryStores=result.stores;}render();$('library-stores').querySelector(`[data-library-store=${id}]`)?.focus({preventScroll:true});};return button;}));
  const shelfGames=state.games.filter(inShelf);
  $('total').textContent = shelfGames.length; $('fav-count').textContent = shelfGames.filter(g => state.favorites.includes(g.key)).length;
  for(const tab of ['installed','owned','web']){$(`${tab}-tab`).setAttribute('aria-selected',shelf===tab);$(`${tab}-count`).textContent=state.games.filter(game=>game[tab]).length;}
  $('web-tools').hidden=shelf!=='web';$('games').classList.toggle('web-mode',shelf==='web');
  $('web-status').textContent=state.webSync?.available?`Public Wavedash catalog · Refreshed ${new Date(state.webSync.importedAt).toLocaleString()} · These entries do not indicate ownership.`:state.webSync?.message || 'Scan to refresh the public browser-game catalog. Saved links are kept locally.';
  $('owned-note').hidden=shelf!=='owned';
  $('owned-note').textContent=state.ownedSync?.available || state.itchSync?.available ? 'Library records from GOG Galaxy, itch.io, and imported files. Xbox records can include console, shared, or subscription titles; PC availability varies.' : 'Sync your existing local library connections to see owned games that are not installed.';
  $('providers').replaceChildren(...Object.entries(providers).map(([id, label]) => {
    const button = node('button'); button.dataset.provider = id; button.classList.toggle('active', provider === id);
    const mark = node('span', `provider-icon ${id}`); const logo = node('img', 'platform-logo'); logo.src = id === 'custom' ? 'assets/icons/gamepad-2.svg' : `assets/platforms/${id}.svg`; logo.alt = ''; mark.append(logo);
    button.append(mark, node('span', '', label), node('b', '', (id==='wavedash'?state.games.filter(game=>game.web):shelfGames).filter(g => g.provider === id).length));
    button.onclick = () => { provider = provider === id ? 'all' : id; if(id==='wavedash')shelf='web';else if(shelf==='web')shelf='installed';view = 'all';visibleLimit=60;render(); }; return button;
  }));
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', view === button.dataset.view && provider === 'all'));
  const title = provider !== 'all' ? providers[provider] : view === 'favorites' ? 'Favorites' : view === 'recent' ? 'Recently launched' : shelf==='web'?'Web games':shelf==='installed'?'Installed games':'Owned games';
  $('section-title').textContent = title;
  $('result-count').textContent = games.length;
  $('library-roots').replaceChildren(...(state.libraryRoots || []).map(root => node('div','library-root',root)));
  $('games').replaceChildren(...games.slice(0,visibleLimit).map(card));
  $('load-more').hidden=games.length<=visibleLimit;
  $('load-more').textContent=`Show more (${Math.min(visibleLimit,games.length)} of ${games.length})`;
  $('empty').hidden = games.length > 0;
  const narrowed = query || provider !== 'all' || view !== 'all'||libraryStores.length!==Object.keys(providers).length;
  $('empty-title').textContent = !libraryStores.length?'Choose a store to show.':query ? 'No games match your search.' : view === 'favorites' ? 'Keep your favorites close.' : view === 'recent' ? 'Your next session starts here.' : provider !== 'all' ? `No ${providers[provider]} games found.` : shelf==='owned'?'Bring your owned library together.':'Your library starts here.';
  $('empty-description').textContent = !libraryStores.length?'Turn on one or more stores above to show your games.':query ? 'Try another title or clear your filters.' : view === 'favorites' ? 'Select the star on a game to save it here.' : view === 'recent' ? 'Games you launch through The Nexus will appear here.' : 'Scan for installed games, or add a game executable or shortcut yourself.';
  $('empty-action').textContent = narrowed ? 'Show all games' : shelf==='owned'?'Sync libraries':'Scan for games';
  $('empty-action').onclick = narrowed ? async () => { view = 'all'; provider = 'all'; query = ''; window.NexusSearch.setQuery('library','');const result=await call('libraryStores',Object.keys(providers));if(result?.stores){libraryStores=result.stores;state.libraryStores=result.stores;}render(); } : shelf==='owned'?()=> $('sources-dialog').showModal():scan;
  if(shelf==='web'&&!narrowed){$('empty-title').textContent='Your browser games start here.';$('empty-description').textContent='Add a Wavedash game link above, or refresh the public catalog.';$('empty-action').textContent='Refresh web games';}
  $('scan-status').textContent = busy ? 'Discovering installed games…' : state.lastScan ? `${state.games.filter(game=>game.installed).length} installed · ${state.games.filter(game=>game.owned).length} in owned libraries · Last scan ${new Date(state.lastScan).toLocaleString()}` : 'Ready when you are.';
  $('catalog-status').textContent=state.ownedSync?.available ? `${state.ownedGames?.length || state.games.filter(game=>game.owned).length} library entries · Imported ${new Date(state.ownedSync.importedAt).toLocaleString()}${state.ownedSync.updatedAt?' · Galaxy cache updated '+state.ownedSync.updatedAt:''}` : state.ownedSync?.message || 'Sync to look for locally connected libraries.';
  const accounts=state.ownedSync?.accounts || [];$('galaxy-account-row').hidden=accounts.length<2;
  $('galaxy-account').replaceChildren(...accounts.map(account=>{const option=node('option','',`Galaxy account ${account.id}`);option.value=account.id;return option;}));if(state.galaxyAccount)$('galaxy-account').value=state.galaxyAccount;
  $('itch-catalog-status').textContent=state.itchSync?.available?`${state.itchSync.installedCount||0} installed · ${state.itchSync.ownedCount||0} cached owned games. ${state.itchSync.message || ''}`:state.itchSync?.message || 'Scan to look for the itch.io app library.';
  const itchAccounts=state.itchSync?.accounts || [];$('itch-account-row').hidden=itchAccounts.length<2;
  $('itch-account').replaceChildren(...itchAccounts.map(account=>{const option=node('option','',`itch.io account ${account.id}`);option.value=account.id;return option;}));if(state.itchAccount)$('itch-account').value=state.itchAccount;
  renderHero();
  if(focusKey && focusAction)document.querySelector(`[data-game-key="${CSS.escape(focusKey)}"] [data-action="${CSS.escape(focusAction)}"]`)?.focus({preventScroll:true});
  document.dispatchEvent(new Event('nexus:render'));
}
function card(game) {
  const el = node('article', 'game-card'); el.dataset.provider = game.provider;el.dataset.gameKey=game.key;
  const cover = node('button', 'cover-button'); cover.setAttribute('aria-label', `View ${game.name}`); cover.onclick = () => details(game);
  const fallback = node('div', 'cover-fallback'); fallback.append(node('small', '', providers[game.provider] || 'LOCAL GAME'), node('strong', '', game.name), node('span', '', 'THE NEXUS'));
  cover.append(fallback); const img = image(game, true); if (img) cover.append(img);
  const overlay = node('div', 'cover-overlay'); const tag = node('span', 'platform-tag'); const logo = node('img', 'platform-logo'); logo.src = game.provider === 'custom' ? 'assets/icons/gamepad-2.svg' : `assets/platforms/${game.provider}.svg`; logo.alt = ''; tag.append(logo, node('span', '', providers[game.provider])); overlay.append(tag); cover.append(overlay);
  const favorite = node('button', 'favorite'); favorite.append(icon('star')); favorite.setAttribute('aria-label', `Favorite ${game.name}`); favorite.setAttribute('aria-pressed', state.favorites.includes(game.key)); favorite.onclick = async () => apply(await call('favorite', game.key));
  const name = node('button', 'game-title', game.name); name.title = game.name; name.onclick = () => details(game);
  const meta = node('div', 'game-meta'); meta.append(node('span', '', game.web?'Browser game':game.installed ? game.sizeGb ? `${game.sizeGb} GB · Installed` : 'Installed' : 'Not installed'));
  const play = node('button', 'quick-play'); play.append(icon(game.installed||game.web?'play':'download'), node('span', '', game.installed||game.web?'Play':clientLabel(game))); play.setAttribute('aria-label', `${game.installed||game.web?'Play':clientLabel(game)} ${game.name}`); play.onclick = () => launch(game); meta.append(play);
  for(const [button,action] of [[cover,'details'],[favorite,'favorite'],[name,'title'],[play,'play']])button.dataset.action=action;
  el.append(cover, favorite, name, node('span','list-provider',providers[game.provider]), meta); return el;
}
async function launch(game) {
  if (busy) return;
  if(!game.installed && !game.web){await call('install',{libraryKey:game.key});window.NexusDownloads.open();return;}
  toast(`Starting ${game.name}…`);
  const result = await call('launch', game.key);
  if (result?.games) { apply(result); toast(`Launch request sent for ${game.name}.`); }
}
async function scan() {
  if (busy) return; busy = true;
  for (const id of ['scan', 'settings-scan', 'empty-action', 'hero-play']) $(id).disabled = true;
  buttonIcon('scan', 'refresh-cw', 'Scanning…'); $('scan-status').textContent = 'Discovering installed games…';
  try { const result = await call('scan'); apply(result); if (result?.games) toast(result.warnings?.length ? `Scan finished. ${result.warnings.join(' ')}` : `${result.games.filter(game=>game.installed).length} installed games found. Your library is up to date.`, Boolean(result.warnings?.length)); }
  finally { busy = false; for (const id of ['scan', 'settings-scan', 'empty-action', 'hero-play']) $(id).disabled = false; buttonIcon('scan', 'refresh-cw', 'Scan library'); render(); }
}
function details(game) {
  selected = game;
  const body = $('detail-content'); body.replaceChildren();
  const img = image(game); if (img) { img.className = 'detail-art'; body.append(img); }
  body.append(node('h2', '', game.name));
  const list = node('dl', 'detail-meta');
  for (const [label, value] of [['Platform', providers[game.provider]],['Status',game.web?'Browser game':game.installed?'Installed':'Not installed'],['Library source',game.ownershipSource || 'Local installation'], ['Install size', game.web?'No local installation':game.sizeGb ? `${game.sizeGb} GB` : 'Not reported'], ['Install folder', game.web?'Runs at wavedash.com':game.installLocation || (game.installed?'Managed by the store client':'Not installed on this PC')], ['Last launched', date(state.history[game.key]?.lastLaunched)], ['Nexus launches', state.history[game.key]?.launches || 0]]) list.append(node('dt', '', label), node('dd', '', value));
  body.append(list);
  const actions = node('div', 'detail-actions'); const play = node('button', 'button primary'); play.append(icon(game.installed||game.web?'play':'download'), node('span', '', game.web?'Play in browser':game.installed?'Play now':clientLabel(game))); play.onclick = () => launch(selected); actions.append(play);
  if(game.provider==='steam'){const achievements=node('button','button secondary','Achievements');achievements.onclick=()=>window.NexusPlatforms.achievements(game.key);actions.append(achievements);}
  const artwork = node('button','button secondary','Change artwork'); artwork.onclick = async () => { const result = await call('artwork',game.key); if (result?.games) { apply(result); details(state.games.find(g => g.key === game.key)); toast('Game artwork saved.'); } }; actions.append(artwork);
  if (game.installLocation) { const folder = node('button', 'button secondary', 'Open folder ↗'); folder.onclick = () => call('folder', game.key); actions.append(folder); }
  if (game.provider === 'custom') { const remove = node('button', 'button danger', 'Remove from library'); remove.onclick = async () => { const result = await call('remove', game.key); if (result?.games) { apply(result); $('detail').close(); toast('Removed from your library. Game files are untouched.'); } }; actions.append(remove); }
  body.append(actions); if (!$('detail').open) $('detail').showModal();
}
$('search').oninput = event => { if(window.NexusSearch.context!=='library')return;query = event.target.value.trim().toLowerCase(); render(); };
$('sort').onchange = render;
document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => { view = button.dataset.view; provider = 'all'; render(); }; });
document.querySelector('.brand').onclick = event => { event.preventDefault(); view = 'all'; provider = 'all'; query = ''; window.NexusSearch.setQuery('library',''); render(); };
for (const id of ['scan', 'settings-scan']) $(id).onclick = scan;
$('settings').onclick = () => $('settings-dialog').showModal();
$('export').onclick = async () => { const result = await call('export'); if (result?.success) toast('Library exported.'); };
$('add').onclick = async () => { const result = await call('add'); apply(result); if (result?.games) toast('Game added to your Nexus.'); };
$('add-library-folder').onclick = async () => { const result = await call('addRoot'); apply(result); if (result?.games) await scan(); };
function clientLabel(game){return game.provider==='wavedash'?'Play in browser':'Install with '+(providers[game.provider]||'store');}
function setShelf(value){shelf=value;if(value!=='web'&&provider==='wavedash')provider='all';if(value==='web'&&provider!=='wavedash')provider='all';visibleLimit=60;render();}
for(const value of ['installed','owned','web'])$(`${value}-tab`).onclick=()=>setShelf(value);
$('load-more').onclick=()=>{visibleLimit+=60;render();};
$('library-sources').onclick=()=>$('sources-dialog').showModal();
$('sync-owned').onclick=async()=>{if(busy)return;busy=true;$('sync-owned').disabled=true;try{apply(await call('syncOwned',$('galaxy-account').value||undefined,$('itch-account').value||undefined));}finally{busy=false;$('sync-owned').disabled=false;render();}};
$('web-add').onclick=async()=>{const url=$('web-url').value.trim();if(!url){$('web-url').focus();return;}$('web-add').disabled=true;try{const result=await call('addWebGame',url);if(result?.games){$('web-url').value='';apply(result);toast('Wavedash game saved.');}}finally{$('web-add').disabled=false;}};
$('import-owned').onclick=async()=>apply(await call('importOwned'));
document.querySelectorAll('dialog .close').forEach(button => { button.onclick = () => button.closest('dialog').close(); });
for (const id of ['grid-view', 'list-view']) $(id).onclick = () => { const list = id === 'list-view'; $('games').classList.toggle('list-mode', list); $('grid-view').setAttribute('aria-pressed', !list); $('list-view').setAttribute('aria-pressed', list); };
for (const [id, name, label] of [['add','plus','Add game'],['scan','refresh-cw','Scan library'],['settings-scan','refresh-cw','Rescan'],['export','download','Export'],['hero-details','external-link','View game']]) buttonIcon(id,name,label);
for (const [selector, name] of [['[data-view=all]>span','library'],['[data-view=favorites]>span','star'],['[data-view=recent]>span','clock-3'],['.empty-icon','sparkles']]) document.querySelector(selector).replaceChildren(icon(name));
$('settings').replaceChildren(icon('settings-2'), node('span','','Settings & library'), icon('arrow-up-right'));
for (const id of ['grid-view','list-view']) $(id).replaceChildren(icon(id === 'grid-view' ? 'layout-grid' : 'list'));
const portalLogo = node('img'); portalLogo.src = 'assets/logo.png'; portalLogo.alt = ''; document.querySelector('.hero-orbit').replaceChildren(portalLogo);
document.querySelectorAll('dialog .close').forEach(button => button.replaceChildren(icon('x')));
(async () => { apply(await call('read')); render(); if (api && !api.nativeSurface && (!state.lastScan || state.scanRevision !== 6)) await scan(); })();

window.nexus.onLibraryChange?.(apply);
