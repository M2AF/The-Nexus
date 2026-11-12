const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, utilityProcess, clipboard, Tray, Menu, globalShortcut, screen, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Worker } = require('node:worker_threads');
const { spawn } = require('node:child_process');
const {RunningGames,invitationChoices}=require('./lib/running-games');
const { createHash } = require('node:crypto');
const { launchPlan,validateExecutable } = require('./lib/launch');
const {mergeLibraries,normalizeOwnedImport,clientPlan}=require('./lib/catalog');
const {readWavedashGame}=require('./lib/indie-platforms');
const {ChainLensClient,ORIGIN:CHAINLENS_ORIGIN}=require('./lib/chainlens-client');
const {DiscoverCatalog}=require('./lib/discover');
const {LOGOS,logoSettings}=require('./lib/appearance');
const Theme=require('./app/theme-colors');
const {startupTarget,startupEnabled}=require('./lib/window-settings');
const {storeDestination,openStore}=require('./lib/store-opening');
const {LIBRARY_STORES,libraryStores}=require('./lib/library-preferences');
const {Installations}=require('./lib/installations');
const {steamLocations}=require('./lib/scanners');
const {Contacts}=require('./lib/contacts');
const {PlatformSessionStore}=require('./lib/platform-session-store');
const {SteamSocial}=require('./lib/steam-social');
const {SteamLocalReader}=require('./lib/steam-local-reader');
const {DiscordConnector}=require('./lib/discord-connector');
const {AccountSocial}=require('./lib/account-social');
const {DesktopLifecycle,desktopPreferences}=require('./lib/desktop-lifecycle');
const {NativeOverlay}=require('./lib/native-overlay');
app.setName('The Nexus');
if (process.env.NEXUS_TEST_DATA) app.setPath('userData', process.env.NEXUS_TEST_DATA);
const primaryInstance=app.requestSingleInstanceLock();if(!primaryInstance)app.quit();
let win, stateFile, scanJob, social, installations, steamSocial, discordSocial, xboxSocial, epicSocial, desktop, nativeOverlay;
app.on('second-instance',()=>desktop?.showMain());
let state = { games: [], ownedGames:[], steamOwnedGames:[], importedOwnedGames:[], itchOwnedGames:[], webGames:[], webPins:[], itchSync:null, webSync:null, ownedSync:null, favorites: [], history: {}, customArt: {}, lastScan: null, scanRevision: 0, libraryRoots: [] };
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
  const {ownedGames,steamOwnedGames,importedOwnedGames,itchOwnedGames,webGames,webPins,...publicState}=state;
  const web=[...new Map([...webGames,...webPins].map(game=>[key(game),{...game,key:key(game),web:true,installed:false,owned:false}])).values()];
  return {...publicState,games:[...mergeLibraries(installed,[...ownedGames,...(steamOwnedGames||[]),...itchOwnedGames,...importedOwnedGames]),...web].map(game=>{const custom=cachedArt(state.customArt?.[game.key]);return custom?{...game,portrait:custom,header:custom}:game;})};
}
function find(id) {
  const game = state.games.find(g => key(g) === id);
  if (!game) throw new Error('Game is no longer in the library. Rescan and try again.');
  return game;
}
function handle(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    const native=nativeOverlay?.trusts(event);
    if (!native&&(event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame)) throw new Error('Untrusted request.');
    if(native){
      if(channel==='window:state')return nativeOverlay.public();
      if(channel==='window:action'){if(['dismiss-overlay','close'].includes(args[0]))nativeOverlay.hide();else if(args[0]==='show-main')nativeOverlay.showMain();else throw Error('Open Full Nexus for window controls.');return nativeOverlay.public();}
      if(!/^(platforms:(state|messages|send|open-chat|invite-options|invite)|contacts:(read|merge|unmerge)|chainlens:(state|call|refresh)|library:read)$/.test(channel)&&!(['appearance:theme','appearance:logo','settings:desktop'].includes(channel)&&args[0]===undefined))return {error:'Open Full Nexus for this action.'};
    }
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
        state.lastScan = new Date().toISOString(); state.scanRevision = 6; save();
        resolve({ ...snapshot(), warnings: result.warnings });
      } catch (error) { reject(error); }
    });
    worker.once('error', error => { clearTimeout(timeout); reject(error); });
    worker.once('exit', code => { clearTimeout(timeout); if (code) reject(new Error(`Scan stopped (${code}).`)); });
  }).finally(() => { scanJob = null; });
  return scanJob;
}
if(primaryInstance)app.whenReady().then(() => {
  const runningGames=new RunningGames();app.once('before-quit',()=>runningGames.close());
  if(process.platform==='win32')app.setAppUserModelId('com.mancave.thenexus');
  state.libraryRoots = [path.join(app.getPath('documents'),'Games')];
  stateFile = path.join(app.getPath('userData'), 'library.json');
  try {
    const loaded = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!Array.isArray(loaded.games) || !Array.isArray(loaded.favorites) || !loaded.history || typeof loaded.history !== 'object') throw new Error('Invalid library');
    state = { ...state, ...loaded };
  } catch { if (fs.existsSync(stateFile)) fs.copyFileSync(stateFile, stateFile + `.backup-${Date.now()}`); }
  if(!state.libraryStoresVersion){if(Array.isArray(state.libraryStores)&&!state.libraryStores.includes('battlenet'))state.libraryStores.push('battlenet');state.libraryStoresVersion=1;}
  try{state.theme=Theme.settings(state.theme);}catch{state.theme={...Theme.defaults};}
  win = new BrowserWindow({ width: 1440, height: 940, minWidth: 800, minHeight: 600, backgroundColor: Theme.palette(state.theme).bg, title: 'The Nexus', icon: path.join(__dirname,'app/assets/icon.png'), autoHideMenuBar: true,
    frame:false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  win.setMenu(null);
  const windowStatus=()=>({fullscreen:win.isFullScreen(),maximized:win.isMaximized(),...desktop?.public()});
  const sendWindowStatus=()=>{if(!win.isDestroyed())win.webContents.send('window:changed',windowStatus());};
  for(const event of ['enter-full-screen','leave-full-screen','maximize','unmaximize'])win.on(event,sendWindowStatus);
  const toggleFullscreen=()=>{win.setFullScreen(!win.isFullScreen());return windowStatus();};
  handle('window:state',windowStatus);
  handle('window:action',action=>{if(action==='overlay')return desktop.toggleOverlay();if(action==='dismiss-overlay'){desktop.dismissOverlay();return windowStatus();}if(action==='show-main')return desktop.showMain();if(action==='quit'){desktop.quit();return;}if(action==='minimize'){win.minimize();return windowStatus();}if(action==='close'){win.close();return;}if(desktop?.overlay&&['fullscreen','maximize'].includes(action))return windowStatus();if(action==='fullscreen')return toggleFullscreen();if(action==='maximize'){if(win.isMaximized())win.unmaximize();else win.maximize();return windowStatus();}throw Error('Unknown window action.');});
  const loginTarget=startupTarget({packaged:app.isPackaged,platform:process.platform,portableExecutable:process.env.PORTABLE_EXECUTABLE_FILE,execPath:process.execPath});
  const startupStatus=()=>{if(!loginTarget)return {available:false,enabled:false};return {available:true,enabled:startupEnabled(app.getLoginItemSettings(loginTarget),loginTarget)};};
  handle('settings:startup',enabled=>{if(enabled!==undefined){if(typeof enabled!=='boolean')throw Error('Choose whether to open at startup.');if(!loginTarget)throw Error('Startup is available in the packaged Windows launcher.');if(!fs.existsSync(loginTarget.path))throw Error('Keep the portable launcher in a permanent folder before enabling startup.');app.setLoginItemSettings({...loginTarget,openAtLogin:enabled,enabled});}return startupStatus();});
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  state.logoAnimated=typeof state.logoAnimated==='boolean'?state.logoAnimated:state.logoVariant==='animated';
  state.logoVariant=Object.hasOwn(LOGOS,state.logoVariant)?state.logoVariant:'blue';
  const updateLogoIcon=()=>{const file=path.join(__dirname,'app/assets',LOGOS[state.logoVariant].file);if(fs.existsSync(file)){win.setIcon(file);desktop?.updateIcon(file);}};updateLogoIcon();
  handle('appearance:theme',value=>{if(value!==undefined){state.theme=Theme.settings(value);save();win.setBackgroundColor(Theme.palette(state.theme).bg);}return state.theme;});
  handle('appearance:logo',variant=>{if(variant!==undefined){Object.assign(state,logoSettings(variant));save();updateLogoIcon();}return {logoVariant:state.logoVariant,logoAnimated:state.logoAnimated};});
  const socialFixture=process.env.NEXUS_SOCIAL_FIXTURE==='1'&&!!process.env.NEXUS_TEST_DATA;
  social=new ChainLensClient({directory:app.getPath('userData'),safeStorage,openExternal:url=>shell.openExternal(url),origin:socialFixture?process.env.NEXUS_SOCIAL_ORIGIN:CHAINLENS_ORIGIN,allowLoopback:socialFixture,onChange:status=>{if(!win.isDestroyed())win.webContents.send('chainlens:changed',status);nativeOverlay?.send('chainlens:changed',status);}});
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
    return openStore(storeDestination(provider,offer.id,region,offer.slug),{hasClient:async url=>{if(process.platform==='linux')return !!app.getApplicationNameForProtocol(url);try{const info=await app.getApplicationInfoForProtocol(url);return !!info.name&&!!info.path&&fs.existsSync(info.path);}catch{return url.startsWith('msxbox:')&&!!app.getApplicationNameForProtocol(url);}},openApplication:async(protocol,args)=>{if(protocol!=='battlenet://')throw Error('Unsupported store client.');const exe=require('./lib/battlenet').clientPath();if(!exe)throw Error('Battle.net is not installed.');await new Promise((resolve,reject)=>{const child=spawn(exe,args,{detached:true,stdio:'ignore',shell:false,windowsHide:true});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});},openExternal:url=>shell.openExternal(url)});
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
  const contacts=new Contacts(app.getPath('userData'));
  const contactState=()=>({groups:contacts.read(),splits:[...contacts.splits]});
  handle('contacts:read',contactState);
  handle('contacts:merge',members=>{contacts.merge(members);return contactState();});
  handle('contacts:unmerge',member=>{contacts.unmerge(member);return contactState();});
  const platformStore=new PlatformSessionStore(app.getPath('userData'),safeStorage);
  const platformChanged=()=>{if(!win.isDestroyed())win.webContents.send('platforms:changed');nativeOverlay?.send('platforms:changed');};
  steamSocial=new SteamSocial({store:platformStore,
    local:!process.env.NEXUS_TEST_DATA&&process.platform==='win32'&&process.arch==='x64'?new SteamLocalReader({utilityProcess,directory:()=>steamLocations().steamPath}):null,
    onChange:platformChanged,
    onAccount:accountId=>{if(state.steamAccountId&&state.steamAccountId!==accountId)state.steamOwnedGames=[];state.steamAccountId=accountId;save();if(!win.isDestroyed())win.webContents.send('library:changed');},
    onLibrary:(games,accountId)=>{state.steamOwnedGames=games;state.steamAccountId=accountId;save();if(!win.isDestroyed())win.webContents.send('library:changed');}
  });
  discordSocial=new DiscordConnector({utilityProcess,store:platformStore,resources:app.isPackaged?process.resourcesPath:path.join(__dirname,'native'),onChange:platformChanged});
  xboxSocial=new AccountSocial({provider:'xbox',store:platformStore,onChange:platformChanged});
  epicSocial=new AccountSocial({provider:'epic',store:platformStore,onChange:platformChanged});
  const platformClient=provider=>{if(provider==='steam')return steamSocial;if(provider==='discord')return discordSocial;if(provider==='xbox')return xboxSocial;if(provider==='epic')return epicSocial;throw Error('This platform does not have a native connection configured yet.');};
  handle('accounts:link',provider=>{const current=['steam','discord'].includes(provider)?platformClient(provider).public():null;return social.linkIdentity(provider,current?.connected?current.accountId:undefined);});
  handle('accounts:poll',async intentId=>{const status=await social.action('identityStatus',{intentId});if(status.status==='linked'&&['xbox','epic'].includes(status.provider)){const session=await social.claimIdentitySession(intentId);await platformClient(status.provider).accept(session);}return status;});
  handle('platforms:state',async()=>{xboxSocial.refresh().catch(()=>{});epicSocial.refresh().catch(()=>{});await steamSocial.refresh();return {steam:steamSocial.public(),discord:await discordSocial.refresh().catch(()=>discordSocial.public()),xbox:xboxSocial.public(),epic:epicSocial.public()};});
  handle('platforms:connect',provider=>{if(['xbox','epic'].includes(provider))throw Error('Connect this platform through Accounts and ChainLens verification.');return platformClient(provider).connect();});
  handle('platforms:disconnect',async provider=>{const result=await platformClient(provider).disconnect();if(provider==='steam'){state.steamOwnedGames=[];state.steamAccountId=null;save();win.webContents.send('library:changed');}return result;});
  handle('platforms:messages',(provider,id)=>platformClient(provider).messages(id));
  handle('platforms:open-chat',(provider,id)=>{if(provider!=='steam')throw Error('This platform uses Nexus chat.');steamSocial.friend(id);throw Error('Choose Message to chat inside The Nexus.');});
  handle('platforms:send',(provider,id,text)=>platformClient(provider).send(id,text));
  const invitationFriend=(provider,id)=>{if(!['steam','discord','xbox','epic'].includes(provider))throw Error('Unsupported invitation platform.');const account=platformClient(provider).public();if(!account.connected||!account.friends.some(friend=>friend.id===id))throw Error('Choose a current connected friend.');return account;};
  const invitationGame=gameKey=>{const game=snapshot().games.find(game=>game.key===gameKey&&game.installed&&!game.web);if(!game)throw Error('Choose an installed game.');return game;};
  const currentInvitationGame=async()=>{const installed=snapshot().games.filter(game=>game.installed&&!game.web).map(game=>({...game,launchTarget:state.games.find(record=>key(record)===game.key)?.launchTarget}));return runningGames.current(installed,state.history);};
  handle('platforms:invite-options',async(provider,id)=>{const account=invitationFriend(provider,id),current=await currentInvitationGame();const native=provider==='steam'?await steamSocial.inviteContext():null;if(process.env.NEXUS_INVITE_DIAGNOSTICS==='1')console.log('Nexus invite diagnostic',JSON.stringify({current:current?.key||null,steam:steamSocial.inviteDiagnostic,friendApp:String(steamSocial.client?.users?.[id]?.gameid||'')}));const games=invitationChoices(snapshot().games,current?.key).map(game=>({key:game.key,name:game.name,provider:game.provider,native:!!native&&game.provider==='steam'&&String(game.catalogId||game.id)===native.appId}));if(invitationFriend(provider,id).accountId!==account.accountId)throw Error('Your account changed. Reopen the invitation.');return {games,currentGameKey:current?.key||null,ownerId:account.accountId,canMessage:provider==='discord'||provider==='steam'&&account.canMessage,externalChat:provider==='steam'&&!account.canMessage};});
  handle('platforms:invite',async(provider,id,gameKey,mode,ownerId)=>{const account=invitationFriend(provider,id);if(account.accountId!==ownerId)throw Error('Your account changed. Reopen the invitation.');const game=invitationGame(gameKey);if(mode==='native'){if(provider!=='steam'||game.provider!=='steam')throw Error('This platform does not expose a joinable session.');return steamSocial.invite(id,String(game.catalogId||game.id));}if(!['message','copy'].includes(mode))throw Error('Unknown invitation action.');const text='Want to play '+String(game.name).replace(/[\r\n\x00-\x1f]/g,' ').slice(0,200)+' with me?';if(mode==='copy'){clipboard.writeText(text);return {success:true,kind:'copied'};}if(!['steam','discord'].includes(provider))throw Error('Messaging is not connected for this platform. Copy the invitation instead.');await platformClient(provider).send(id,text);return {success:true,kind:'message'};});
  handle('platforms:steam-library',()=>steamSocial.syncLibrary());
  handle('platforms:achievements',key=>{const game=snapshot().games.find(game=>game.key===key);if(!game||game.provider!=='steam')throw Error('Achievements require a connected, supported platform game.');return steamSocial.achievements(game.catalogId||game.id);});
  steamSocial.restore();discordSocial.restore();xboxSocial.restore();epicSocial.restore();
  app.once('before-quit',()=>{steamSocial.close();discordSocial.close();xboxSocial.close();epicSocial.close();});
  const openInstallClient=async game=>{
    const plan=clientPlan(game);
    if(plan.url)await shell.openExternal(plan.url);
    else await new Promise((resolve,reject)=>{const child=spawn(plan.exe,plan.args,{detached:true,stdio:'ignore',shell:false});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
  };
  const broadcastLibrary=()=>{if(!win.isDestroyed())win.webContents.send('library:changed');};
  installations=new Installations({directory:app.getPath('userData'),openClient:openInstallClient,steamFolders:()=>steamLocations(state.libraryRoots).folders,library:()=>snapshot().games,onChange:data=>{if(!win.isDestroyed())win.webContents.send('installs:changed',data);},onInstalled:async jobs=>{if(jobs.some(job=>job.provider==='steam'))await scan();broadcastLibrary();}});
  installations.start();
  const installGame=request=>{
    if(!request||typeof request!=='object')throw Error('Choose an owned game to install.');
    const games=snapshot().games;
    if(typeof request.libraryKey==='string'){const game=games.find(game=>game.key===request.libraryKey&&game.owned);if(!game)throw Error('Owned library record not found.');return game;}
    if(typeof request.discoverKey==='string'&&typeof request.provider==='string'){
      const offer=discover.find(request.discoverKey,request.region).offers.find(offer=>offer.provider===request.provider);
      if(!offer)throw Error('Store listing is no longer available.');
      const game=games.find(game=>game.provider===offer.provider&&game.owned&&(String(game.id)===String(offer.id)||String(game.catalogId)===String(offer.id)));
      if(!game)throw Error('This exact store edition is not in the owned library. Sync your library connections first.');return game;
    }throw Error('Choose a valid library or store listing.');
  };
  handle('installs:state',()=>installations.snapshot());
  handle('installs:request',request=>installations.request(installGame(request)));
  handle('installs:remove',key=>installations.remove(key));
  handle('installs:reopen',key=>installations.reopen(key,job=>snapshot().games.find(game=>game.provider===job.provider&&String(game.catalogId||game.id)===job.id&&game.owned)));
  handle('installs:refresh',async()=>{await scan();await installations.poll();broadcastLibrary();return installations.snapshot();});
  const installScanTimer=setInterval(()=>{if(installations.snapshot().jobs.some(job=>job.provider!=='steam'&&['waiting','requested'].includes(job.status)))scan().then(()=>{broadcastLibrary();return installations.poll();}).catch(()=>{});},45000);installScanTimer.unref();
  app.once('before-quit',()=>{clearInterval(installScanTimer);installations.close();});
  handle('library:openClient',async id=>{const game=snapshot().games.find(game=>game.key===id&&game.owned);if(!game)throw Error('Owned library record not found.');await openInstallClient(game);return {success:true};});
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
  let preferences;try{preferences=desktopPreferences(state.desktop||{});}catch{preferences=desktopPreferences();}
  if(process.env.NEXUS_NATIVE_OVERLAY==='1'&&!process.env.NEXUS_TEST_DATA&&process.platform==='win32'&&process.arch==='x64'){nativeOverlay=new NativeOverlay({BrowserWindow,resources:path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'native'),'overlay'),preload:path.join(__dirname,'preload.js'),url:pathToFileURL(path.join(__dirname,'app/index.html')).href,mainWindow:win,getTarget:async()=>{runningGames.cache=null;const installed=snapshot().games.filter(game=>game.installed&&!game.web).map(game=>({...game,launchTarget:state.games.find(record=>key(record)===game.key)?.launchTarget})),target=await runningGames.target(installed,state.history);if(!target)return null;return {pid:target.pid,path:target.path,game:{key:target.game.key,name:target.game.name,provider:target.game.provider,id:String(target.game.catalogId||target.game.id)}};},onError:message=>{if(!win.isDestroyed())win.webContents.send('overlay:error',message);}});}
  app.on('before-quit',()=>nativeOverlay?.close());
  desktop=new DesktopLifecycle({nativeOverlay,app,win,Tray,Menu,globalShortcut,screen,icon:path.join(__dirname,'app/assets/icon.png'),preferences,onPreferences:value=>{state.desktop=value;save();},onChange:sendWindowStatus,getGame:async()=>{const game=await currentInvitationGame();return game?{key:game.key,name:game.name,provider:game.provider,id:String(game.catalogId||game.id)}:null;}});
  handle('settings:desktop',value=>desktop.settings(value));
  win.webContents.on('did-finish-load',sendWindowStatus);
  win.loadURL(pathToFileURL(path.join(__dirname, 'app/index.html')).href);
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit',()=>social?.close());
