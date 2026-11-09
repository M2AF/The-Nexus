const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Worker } = require('node:worker_threads');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { launchPlan,validateExecutable } = require('./lib/launch');
const {mergeLibraries,normalizeOwnedImport,clientPlan}=require('./lib/catalog');
const {readWavedashGame}=require('./lib/indie-platforms');
const {ChainLensClient,ORIGIN:CHAINLENS_ORIGIN}=require('./lib/chainlens-client');
const {DiscoverCatalog}=require('./lib/discover');
const {LOGOS,logoSettings}=require('./lib/appearance');
const {startupTarget,startupEnabled}=require('./lib/window-settings');
const {storeDestination,openStore}=require('./lib/store-opening');
const {LIBRARY_STORES,libraryStores}=require('./lib/library-preferences');
app.setName('The Nexus');
if (process.env.NEXUS_TEST_DATA) app.setPath('userData', process.env.NEXUS_TEST_DATA);
let win, stateFile, scanJob, social;
let state = { games: [], ownedGames:[], importedOwnedGames:[], itchOwnedGames:[], webGames:[], webPins:[], itchSync:null, webSync:null, ownedSync:null, favorites: [], history: {}, customArt: {}, lastScan: null, scanRevision: 0, libraryRoots: [] };
const key = game => `${game.provider}:${game.id}`;
function save() {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile + '.tmp', JSON.stringify(state, null, 2));
  fs.renameSync(stateFile + '.tmp', stateFile);
}
function snapshot() {
  const cachedArt = file => {
    try { if (file && /\.(jpg|png)$/i.test(file) && fs.statSync(file).size < 5e6) return `data:image/${/\.png$/i.test(file) ? 'png' : 'jpeg'};base64,${fs.readFileSync(file).toString('base64')}`; } catch { /* cache unavailable */ }
    return null;
  };
  const installed=state.games.map(({ launchTarget, portraitPath, headerPath, ...game }) => {
    const custom = cachedArt(state.customArt?.[key(game)]);
    const portrait = cachedArt(portraitPath), header = cachedArt(headerPath);
    return {...game,portrait:custom || portrait || header || game.portrait,header:custom || header || portrait || game.header,key:key(game)};
  });
  const {ownedGames,importedOwnedGames,itchOwnedGames,webGames,webPins,...publicState}=state;
  const web=[...new Map([...webGames,...webPins].map(game=>[key(game),{...game,key:key(game),web:true,installed:false,owned:false}])).values()];
  return {...publicState,games:[...mergeLibraries(installed,[...ownedGames,...itchOwnedGames,...importedOwnedGames]),...web].map(game=>{const custom=cachedArt(state.customArt?.[game.key]);return custom?{...game,portrait:custom,header:custom}:game;})};
}
function find(id) {
  const game = state.games.find(g => key(g) === id);
  if (!game) throw new Error('Game is no longer in the library. Rescan and try again.');
  return game;
}
function handle(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Untrusted request.');
    try { return await action(...args); } catch (error) { return { error: error.message }; }
  });
}
function scan() {
  if (scanJob) return scanJob;
  scanJob = new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'lib/scan-worker.js'), {workerData:{artDirectory:path.join(app.getPath('userData'),'artwork'),libraryRoots:state.libraryRoots,galaxyDatabase:path.join(process.env.ProgramData||'C:\\ProgramData','GOG.com','Galaxy','storage','galaxy-2.0.db'),galaxyAccount:state.galaxyAccount,itchDatabase:path.join(app.getPath('appData'),'itch','db','butler.db'),itchAccount:state.itchAccount}});
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Scan timed out. Please try again.')); }, 90000);
    worker.once('message', result => {
      clearTimeout(timeout);
      try {
        state.games = [...result.games, ...state.games.filter(g => g.provider === 'custom')];
        if(result.owned){
          const {games:owned,...status}=result.owned;
          state.ownedSync=status;
          if(status.available && !status.needsAccount){state.ownedGames=owned;state.galaxyAccount=status.accountId;}
        }
        if(result.itch){const {installed,owned,...status}=result.itch;state.itchSync=status;if(status.available&&!status.needsAccount){state.itchOwnedGames=owned;state.itchAccount=status.accountId;}}
        if(result.web){const {games,...status}=result.web;state.webSync=status;if(status.available){const keep=state.webGames.filter(game=>state.favorites.includes(key(game))||state.history[key(game)]);state.webGames=[...new Map([...keep,...games].map(game=>[key(game),game])).values()];}}
        state.lastScan = new Date().toISOString(); state.scanRevision = 5; save();
        resolve({ ...snapshot(), warnings: result.warnings });
      } catch (error) { reject(error); }
    });
    worker.once('error', error => { clearTimeout(timeout); reject(error); });
    worker.once('exit', code => { clearTimeout(timeout); if (code) reject(new Error(`Scan stopped (${code}).`)); });
  }).finally(() => { scanJob = null; });
  return scanJob;
}
app.whenReady().then(() => {
  if(process.platform==='win32')app.setAppUserModelId('com.mancave.thenexus');
  state.libraryRoots = [path.join(app.getPath('documents'),'Games')];
  stateFile = path.join(app.getPath('userData'), 'library.json');
  try {
    const loaded = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!Array.isArray(loaded.games) || !Array.isArray(loaded.favorites) || !loaded.history || typeof loaded.history !== 'object') throw new Error('Invalid library');
    state = { ...state, ...loaded };
  } catch { if (fs.existsSync(stateFile)) fs.copyFileSync(stateFile, stateFile + `.backup-${Date.now()}`); }
  win = new BrowserWindow({ width: 1440, height: 940, minWidth: 800, minHeight: 600, backgroundColor: '#0c1018', title: 'The Nexus', icon: path.join(__dirname,'app/assets/icon.png'), autoHideMenuBar: true,
    titleBarStyle:'hidden',titleBarOverlay:{color:'#0c1018',symbolColor:'#9aabbf',height:32},
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  win.setMenu(null);
  const windowStatus=()=>({fullscreen:win.isFullScreen(),maximized:win.isMaximized()});
  const sendWindowStatus=()=>{if(!win.isDestroyed())win.webContents.send('window:changed',windowStatus());};
  for(const event of ['enter-full-screen','leave-full-screen','maximize','unmaximize'])win.on(event,sendWindowStatus);
  const toggleFullscreen=()=>{win.setFullScreen(!win.isFullScreen());return windowStatus();};
  handle('window:state',windowStatus);
  handle('window:action',action=>{if(action==='fullscreen')return toggleFullscreen();if(action==='maximize'){if(win.isMaximized())win.unmaximize();else win.maximize();return windowStatus();}throw Error('Unknown window action.');});
  const loginTarget=startupTarget({packaged:app.isPackaged,platform:process.platform,portableExecutable:process.env.PORTABLE_EXECUTABLE_FILE,execPath:process.execPath});
  const startupStatus=()=>{if(!loginTarget)return {available:false,enabled:false};return {available:true,enabled:startupEnabled(app.getLoginItemSettings(loginTarget),loginTarget)};};
  handle('settings:startup',enabled=>{if(enabled!==undefined){if(typeof enabled!=='boolean')throw Error('Choose whether to open at startup.');if(!loginTarget)throw Error('Startup is available in the packaged Windows launcher.');if(!fs.existsSync(loginTarget.path))throw Error('Keep the portable launcher in a permanent folder before enabling startup.');app.setLoginItemSettings({...loginTarget,openAtLogin:enabled,enabled});}return startupStatus();});
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  state.logoAnimated=typeof state.logoAnimated==='boolean'?state.logoAnimated:state.logoVariant==='animated';
  state.logoVariant=Object.hasOwn(LOGOS,state.logoVariant)?state.logoVariant:'blue';
  const updateLogoIcon=()=>{const file=path.join(__dirname,'app/assets',LOGOS[state.logoVariant].file);if(fs.existsSync(file))win.setIcon(file);};updateLogoIcon();
  handle('appearance:logo',variant=>{if(variant!==undefined){Object.assign(state,logoSettings(variant));save();updateLogoIcon();}return {logoVariant:state.logoVariant,logoAnimated:state.logoAnimated};});
  const socialFixture=process.env.NEXUS_SOCIAL_FIXTURE==='1'&&!!process.env.NEXUS_TEST_DATA;
  social=new ChainLensClient({directory:app.getPath('userData'),safeStorage,openExternal:url=>shell.openExternal(url),origin:socialFixture?process.env.NEXUS_SOCIAL_ORIGIN:CHAINLENS_ORIGIN,allowLoopback:socialFixture,onChange:status=>{if(!win.isDestroyed())win.webContents.send('chainlens:changed',status);}});
  handle('chainlens:state',()=>social.public());
  handle('chainlens:login',()=>social.login());
  handle('chainlens:cancel',()=>{social.cancelLogin();return social.public();});
  handle('chainlens:logout',()=>social.logout());
  handle('chainlens:retry',()=>social.restore());
  handle('chainlens:refresh',()=>social.credential?social.refreshIdentity():social.public());
  handle('chainlens:call',(action,args)=>social.action(action,args));
  handle('chainlens:profile',async()=>{await shell.openExternal(CHAINLENS_ORIGIN+'/nexus-account.html');return {success:true};});
  social.restore().catch(()=>{});
  handle('library:read', snapshot);
  handle('library:stores',value=>{if(value!==undefined){state.libraryStores=libraryStores(value);save();}let stores;try{stores=libraryStores(state.libraryStores);}catch{stores=[...LIBRARY_STORES];}return {stores};});
  const discover=new DiscoverCatalog({directory:app.getPath('userData')});
  handle('discover:browse',options=>discover.browse(options));
  handle('discover:details',(key,region)=>discover.details(key,region));
  handle('discover:preview',(key,region)=>discover.preview(key,region));
  handle('discover:preferences',value=>value?discover.setPreferences(value):discover.preferences);
  handle('discover:ownership',()=>mergeLibraries(state.games,[...state.ownedGames,...state.itchOwnedGames,...state.importedOwnedGames]).map(({provider,id,catalogId,name,owned,installed})=>({provider,id,catalogId,name,owned,installed})));
  handle('discover:open',async(key,provider,region)=>{
    discover.open(key,provider,region); // Validate that this exact listing exists in the catalog.
    const offer=discover.find(key,region).offers.find(item=>item.provider===provider);
    return openStore(storeDestination(provider,offer.id,region,offer.slug),{hasClient:async url=>{if(process.platform==='linux')return !!app.getApplicationNameForProtocol(url);try{const info=await app.getApplicationInfoForProtocol(url);return !!info.name&&!!info.path&&fs.existsSync(info.path);}catch{return url.startsWith('msxbox:')&&!!app.getApplicationNameForProtocol(url);}},openExternal:url=>shell.openExternal(url)});
  });
  handle('library:scan', scan);
  handle('owned:sync',async(account,itchAccount)=>{for(const value of [account,itchAccount])if(value&&!/^\d+$/.test(String(value)))throw new Error('Invalid library account.');if(account)state.galaxyAccount=String(account);if(itchAccount)state.itchAccount=String(itchAccount);return scan();});
  handle('web:add',async url=>{const game=await readWavedashGame(String(url));const map=new Map(state.webPins.map(game=>[key(game),game]));map.set(key(game),game);state.webPins=[...map.values()];save();return snapshot();});
  handle('owned:import',async()=>{
    const result=await dialog.showOpenDialog(win,{title:'Import an owned game library',properties:['openFile'],filters:[{name:'JSON library',extensions:['json']}]});
    if(result.canceled)return {canceled:true};
    if(fs.statSync(result.filePaths[0]).size>20e6)throw new Error('Library file is too large (maximum 20 MB).');
    const games=normalizeOwnedImport(JSON.parse(fs.readFileSync(result.filePaths[0],'utf8')));
    const map=new Map(state.importedOwnedGames.map(game=>[key(game),game]));for(const game of games)map.set(key(game),game);
    state.importedOwnedGames=[...map.values()];save();return snapshot();
  });
  handle('library:openClient',async id=>{
    const game=snapshot().games.find(game=>game.key===id && game.owned);
    if(!game)throw new Error('Owned library record not found.');
    const plan=clientPlan(game);
    if(plan.url)await shell.openExternal(plan.url);
    else await new Promise((resolve,reject)=>{const child=spawn(plan.exe,plan.args,{detached:true,stdio:'ignore',shell:false});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
    return {success:true};
  });
  handle('library:addRoot', async () => {
    const result = await dialog.showOpenDialog(win,{title:'Choose a game library folder',properties:['openDirectory']});
    if (result.canceled) return {canceled:true};
    const folder = result.filePaths[0];
    if (!fs.statSync(folder).isDirectory()) throw new Error('Select a game library folder.');
    if (!state.libraryRoots.some(root => root.toLowerCase() === folder.toLowerCase())) state.libraryRoots.push(folder);
    state.scanRevision = 0; save(); return snapshot();
  });
  handle('library:favorite', id => {
    if(!snapshot().games.some(game=>game.key===id))throw new Error('Game is no longer in the library.'); state.favorites = state.favorites.includes(id) ? state.favorites.filter(k => k !== id) : [...state.favorites, id];
    save(); return snapshot();
  });
  handle('library:add', async () => {
    const result = await dialog.showOpenDialog(win, { title: process.platform==='win32'?'Add a game executable or shortcut':'Add a native game executable or AppImage', properties: ['openFile'], ...(process.platform==='win32'?{filters:[{name:'Games and shortcuts',extensions:['exe','lnk']}]}:{}) });
    if (result.canceled) return { canceled: true };
    const exe = result.filePaths[0];
    validateExecutable(exe);
    const game = { provider: 'custom', providerLabel: 'Local game', id: createHash('sha256').update(process.platform==='win32'?exe.toLowerCase():exe).digest('hex'), name: path.basename(exe, path.extname(exe)), installLocation: path.dirname(exe), launchTarget: { exe } };
    if (!state.games.some(g => key(g) === key(game))) state.games.push(game);
    save(); return snapshot();
  });
  handle('library:remove', id => {
    if (find(id).provider !== 'custom') throw new Error('Only manually added games can be removed.');
    state.games = state.games.filter(g => key(g) !== id); state.favorites = state.favorites.filter(k => k !== id); delete state.history[id];
    save(); return snapshot();
  });
  handle('library:artwork', async id => {
    if(!snapshot().games.some(game=>game.key===id))throw new Error('Game is no longer in the library.');
    const result = await dialog.showOpenDialog(win, {title:'Choose game artwork',properties:['openFile'],filters:[{name:'Game artwork',extensions:['jpg','jpeg','png']}]});
    if (result.canceled) return {canceled:true};
    const source = result.filePaths[0];
    if (fs.statSync(source).size > 5e6) throw new Error('Select an image smaller than 5 MB.');
    const bytes = fs.readFileSync(source);
    const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpg) throw new Error('Select a PNG or JPEG image.');
    const folder = path.join(app.getPath('userData'),'artwork'); fs.mkdirSync(folder,{recursive:true});
    const target = path.join(folder,createHash('sha256').update(id).digest('hex') + (png ? '.png' : '.jpg'));
    fs.writeFileSync(target,bytes); state.customArt ||= {}; state.customArt[id] = target; save(); return snapshot();
  });
  handle('library:launch', async id => {
    const game=state.games.find(game=>key(game)===id) || snapshot().games.find(game=>game.key===id && game.web);
    if(!game)throw new Error('Game is no longer in the library. Rescan and try again.');
    const plan = launchPlan(game);
    if (plan.url) await shell.openExternal(plan.url);
    else if (/\.lnk$/i.test(plan.exe)) { const error = await shell.openPath(plan.exe); if (error) throw new Error(error); }
    else await new Promise((resolve, reject) => {
      const child = spawn(plan.exe, plan.args || [], { cwd: plan.cwd, detached: true, stdio: 'ignore', windowsHide: false, shell: false });
      child.once('error', reject); child.once('spawn', () => { child.unref(); resolve(); });
    });
    state.history[id] = { lastLaunched: new Date().toISOString(), launches: (state.history[id]?.launches || 0) + 1 };
    save(); return snapshot();
  });
  handle('library:folder', async id => {
    const folder = find(id).installLocation;
    if (!folder || !fs.existsSync(folder)) throw new Error('Install folder unavailable for this game.');
    const error = await shell.openPath(folder); if (error) throw new Error(error); return { success: true };
  });
  handle('library:export', async () => {
    const result = await dialog.showSaveDialog(win, { defaultPath: 'The-Nexus-library.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled) return { canceled: true };
    fs.writeFileSync(result.filePath, JSON.stringify(snapshot(), null, 2)); return { success: true };
  });
  win.loadURL(pathToFileURL(path.join(__dirname, 'app/index.html')).href);
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit',()=>social?.close());
