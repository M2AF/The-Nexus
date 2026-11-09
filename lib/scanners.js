const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync, execFile, execFileSync } = require('node:child_process');
const GAME_PROVIDER_LABELS = { steam: 'Steam', xbox: 'Xbox', gog: 'GOG', epic: 'Epic' };

function steamArtCache(steamPath, appId, name) {
  const root = path.join(steamPath,'appcache','librarycache',appId);
  const candidates = [path.join(root, name + '.jpg'), path.join(steamPath, 'appcache', 'librarycache', appId + '_' + name + '.jpg')];
  // New Steam clients put renamed assets under per-image hash directories.
  const filename = name === 'library_600x900' ? 'library_capsule.jpg' : name + '.jpg';
  try { for (const entry of fs.readdirSync(root,{withFileTypes:true})) if (entry.isDirectory()) candidates.push(path.join(root,entry.name,filename)); } catch { /* No cached artwork. */ }
  return candidates.find(file => fs.existsSync(file)) || '';
}

function normalizeGameName(name) {
  return String(name || '')
    .replace(/[™®©]/g, '')
    .replace(/\b(game of the year|goty|edition|standard|deluxe|ultimate|windows|win10|xbox|pc)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSizeGb(bytes) {
  const n = Number(bytes || 0);
  return n > 0 ? (n / 1e9).toFixed(1) : null;
}

function cleanPathValue(value) {
  return String(value || '').trim().replace(/^"|"$/g, '');
}

function safeJsonParse(raw, fallback = null) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function execFileText(file, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024 * 16, ...opts }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; reject(err); return; }
      resolve(stdout || '');
    });
  });
}

async function runPowerShellJson(script) {
  if (process.platform !== 'win32') return null;
  const stdout = await execFileText('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]);
  return safeJsonParse(stdout.trim(), null);
}

function makeGame(provider, fields) {
  const id = String(fields.id || fields.appId || fields.packageFamilyName || fields.appName || fields.name || '').trim();
  const name = String(fields.name || fields.displayName || id || 'Untitled Game').trim();
  return {
    provider,
    providerLabel: GAME_PROVIDER_LABELS[provider] || provider,
    id,
    name,
    searchName: normalizeGameName(name).toLowerCase(),
    ...fields,
  };
}

function uniqueGames(games) {
  const seen = new Set();
  const out = [];
  for (const game of games || []) {
    if (!game || !game.provider || !game.name) continue;
    const key = `${game.provider}:${game.id || game.appId || game.packageFamilyName || game.name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(game);
  }
  return out.sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.provider).localeCompare(String(b.provider)));
}

function getWindowsDriveRoots() {
  if (process.platform !== 'win32') return [];
  const roots = [];
  for (let code = 67; code <= 90; code++) {
    const root = String.fromCharCode(code) + ':\\';
    try { if (fs.existsSync(root)) roots.push(root); } catch { /* inaccessible drive */ }
  }
  return roots;
}

function defaultLibraryRoots() { return [path.join(os.homedir(),'Documents','Games')]; }
function platformRoots(roots, provider) {
  return uniquePaths((roots || defaultLibraryRoots()).flatMap(root => [root,path.join(root,provider),path.join(root,provider,'Games'),path.join(root,provider+'Games')]));
}
function getXboxInstallRoots(libraryRoots) {
  if (process.platform !== 'win32') return [];
  return uniquePaths([...getWindowsDriveRoots().map(root => path.join(root, 'XboxGames')), ...platformRoots(libraryRoots,'Xbox')].filter(p => fs.existsSync(p)));
}

function uniquePaths(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths || []) {
    const key = String(p || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function xmlAttribute(text, name) {
  const value = String(text || '').match(new RegExp('(?:^|\\s)' + name + '=["\x27]([^"\x27]*)["\x27]', 'i'))?.[1] || '';
  return value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function localAsset(root, relative) {
  if (!relative) return '';
  const absolute = path.resolve(root,relative.replace(/\\/g,path.sep));
  return absolute.startsWith(path.resolve(root)+path.sep) && fs.existsSync(absolute) ? absolute : '';
}
function readXboxGameFolders(libraryRoots) {
  const games = [];
  for (const root of getXboxInstallRoots(libraryRoots)) {
    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folderPath = path.join(root, entry.name);
      const contentPath = path.join(folderPath, 'Content');
      const configPath = path.join(contentPath, 'MicrosoftGame.config');
      let config = '', manifest = '';
      try { if (fs.existsSync(configPath)) config = fs.readFileSync(configPath, 'utf8'); } catch { /* unreadable config */ }
      try { manifest = fs.readFileSync(path.join(contentPath,'appxmanifest.xml'),'utf8'); } catch { /* not an AppX install */ }
      if (!config && !manifest) continue;
      if (/<TargetDeviceFamilyForDLC>|<MainPackageDependency\b/i.test(config)) continue;
      const visuals = config.match(/<ShellVisuals\b[^>]*>/i)?.[0] || manifest.match(/<(?:\w+:)?VisualElements\b[^>]*>/i)?.[0] || '';
      const identity = (config || manifest).match(/<Identity\b[^>]*>/i)?.[0] || '';
      const executableTag = config.match(/<Executable\b[^>]*>/i)?.[0] || manifest.match(/<Application\b[^>]*>/i)?.[0] || '';
      const executable = xmlAttribute(executableTag, config ? 'Name' : 'Executable');
      if (!executable || !localAsset(contentPath,executable)) continue;
      const displayName = xmlAttribute(visuals,'DefaultDisplayName') || xmlAttribute(visuals,'DisplayName') || entry.name;
      const portraitPath = localAsset(contentPath,xmlAttribute(visuals,'Square480x480Logo') || xmlAttribute(visuals,'Square150x150Logo') || xmlAttribute(visuals,'StoreLogo'));
      const splash = xmlAttribute(visuals,'SplashScreenImage') || xmlAttribute(manifest.match(/<(?:\w+:)?SplashScreen\b[^>]*>/i)?.[0],'Image');
      games.push({
        folderName: entry.name,
        name: displayName.startsWith('ms-resource:') ? entry.name : displayName,
        packageName: xmlAttribute(identity,'Name'),
        executable,
        portraitPath,
        headerPath: localAsset(contentPath,splash) || portraitPath,
        installLocation: folderPath,
        contentPath,
      });
    }
  }
  return games;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function startAppMatchesPackage(startApp, pkg) {
  const appId = String(startApp?.AppID || startApp?.AppId || startApp?.appId || '');
  const pfn = String(pkg?.PackageFamilyName || '');
  if (pfn && appId.toLowerCase().startsWith(pfn.toLowerCase() + '!')) return true;
  const packageName = String(pkg?.Name || '').toLowerCase();
  if (packageName && appId.toLowerCase().includes(packageName)) return true;
  return false;
}

function startAppMatchesFolder(startApp, folderGame) {
  const appName = normalizeGameName(startApp?.Name || '').toLowerCase();
  const folderName = normalizeGameName(folderGame?.name || folderGame?.folderName || '').toLowerCase();
  const appId = String(startApp?.AppID || '').toLowerCase();
  const packageName = String(folderGame?.packageName || '').toLowerCase();
  if (packageName && appId.includes(packageName)) return true;
  return appName && folderName && (appName === folderName || appName.includes(folderName) || folderName.includes(appName));
}

async function scanSteamLibrary(libraryRoots) {
  try {
    let steamPath = null;

    if (process.platform === 'win32') {
      try {
        const out = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', { encoding: 'utf-8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
        const match = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
        if (match) steamPath = match[1].trim().replace(/\//g, '\\');
      } catch {
        try {
          const out = execSync('reg query "HKLM\\Software\\Wow6432Node\\Valve\\Steam" /v InstallPath', { encoding: 'utf-8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
          const match = out.match(/InstallPath\s+REG_SZ\s+(.+)/i);
          if (match) steamPath = match[1].trim();
        } catch { return []; }
      }
    } else if (process.platform === 'linux') {
      const candidates = [path.join(os.homedir(), '.steam', 'steam'), path.join(os.homedir(), '.local', 'share', 'Steam')];
      steamPath = candidates.find(p => fs.existsSync(p)) || null;
    } else if (process.platform === 'darwin') {
      steamPath = path.join(os.homedir(), 'Library', 'Application Support', 'Steam');
    }

    if (!steamPath || !fs.existsSync(steamPath)) return [];

    const libraryFolders = uniquePaths([path.join(steamPath, 'steamapps'), ...platformRoots(libraryRoots,'Steam').flatMap(root => [root,path.join(root,'steamapps')])].filter(root => fs.existsSync(root)));
    const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(vdfPath)) {
      const vdf = fs.readFileSync(vdfPath, 'utf-8');
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/gi)) {
        const libApps = path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps');
        if (fs.existsSync(libApps) && !libraryFolders.includes(libApps)) libraryFolders.push(libApps);
      }
    }

    const games = [];
    const seenAppIds = new Set();
    for (const libPath of libraryFolders) {
      let entries;
      try { entries = fs.readdirSync(libPath); } catch { continue; }
      for (const entry of entries) {
        if (!entry.startsWith('appmanifest_') || !entry.endsWith('.acf')) continue;
        try {
          const acf = fs.readFileSync(path.join(libPath, entry), 'utf-8');
          const appId = (acf.match(/"appid"\s+"(\d+)"/i) || [])[1];
          const name = (acf.match(/"name"\s+"([^"]+)"/i) || [])[1];
          const installDir = (acf.match(/"installdir"\s+"([^"]+)"/i) || [])[1];
          const installLocation = installDir ? path.join(libPath, 'common', installDir) : '';
          if (installLocation && !fs.existsSync(installLocation)) continue;
          if (appId === '228980') continue; // Steamworks shared redistributables are not a game.
          const sizeKb = (acf.match(/"SizeOnDisk"\s+"(\d+)"/i) || [])[1];
          if (appId && name && !seenAppIds.has(appId)) {
            seenAppIds.add(appId);
            games.push(makeGame('steam', {
              id: appId,
              appId,
              name,
              installLocation,
              portraitPath: steamArtCache(steamPath, appId, 'library_600x900'),
              headerPath: steamArtCache(steamPath, appId, 'library_hero') || steamArtCache(steamPath, appId, 'header'),
              sizeGb: sizeKb ? (parseInt(sizeKb, 10) / 1e9).toFixed(1) : null,
              header: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
              portrait: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
              launchType: 'steam',
              launchTarget: appId,
            }));
          }
        } catch { /* skip malformed acf */ }
      }
    }
    return uniqueGames(games);
  } catch { return []; }
}

async function scanXboxLibrary(libraryRoots) {
  if (process.platform !== 'win32') return [];
  try {
    const folderGames = readXboxGameFolders(libraryRoots);
    const ps = `
      $packages = Get-AppxPackage | Select-Object Name, PackageFamilyName, InstallLocation, Publisher, SignatureKind
      $startApps = Get-StartApps | Select-Object Name, AppID
      [pscustomobject]@{ Packages = $packages; StartApps = $startApps } | ConvertTo-Json -Depth 5
    `;
    const data = await runPowerShellJson(ps).catch(() => null);
    const packages = asArray(data?.Packages);
    const startApps = asArray(data?.StartApps);
    const xboxRoots = getXboxInstallRoots(libraryRoots).map(p => p.toLowerCase());
    const games = [];

    for (const folderGame of folderGames) {
      const pkg = packages.find(p => {
        const loc = String(p.InstallLocation || '').toLowerCase();
        const pkgName = String(p.Name || '').toLowerCase();
        return loc && folderGame.contentPath && folderGame.contentPath.toLowerCase().startsWith(loc) ||
          (folderGame.packageName && pkgName === folderGame.packageName.toLowerCase());
      });
      const startApp = startApps.find(a => startAppMatchesPackage(a, pkg)) || startApps.find(a => startAppMatchesFolder(a, folderGame));
      const aumid = startApp?.AppID || startApp?.AppId || '';
      if (!aumid) continue;
      games.push(makeGame('xbox', {
        id: aumid,
        name: folderGame.name || startApp.Name,
        packageFamilyName: pkg?.PackageFamilyName || '',
        installLocation: folderGame.installLocation,
        portraitPath: folderGame.portraitPath,
        headerPath: folderGame.headerPath,
        launchType: 'xbox-aumid',
        launchTarget: { aumid },
      }));
    }

    for (const pkg of packages) {
      if (/^Microsoft\.(GamingApp|GamingServices|Xbox)/i.test(String(pkg.Name || ''))) continue;
      const installLocation = String(pkg.InstallLocation || '');
      const lowerLocation = installLocation.toLowerCase();
      const startsInXboxRoot = xboxRoots.some(root => lowerLocation.startsWith(root.toLowerCase()));
      const knownGamePackage = /halo|forza|minecraft|seaofthieves|flight|bethesda|zenimax|doublefine|obsidian|microsoft\.studios|microsoft\.gaming/i.test(String(pkg.Name || ''));
      if (!startsInXboxRoot && !knownGamePackage) continue;
      const startApp = startApps.find(a => startAppMatchesPackage(a, pkg));
      const aumid = startApp?.AppID || startApp?.AppId || '';
      if (!aumid) continue;
      games.push(makeGame('xbox', {
        id: aumid,
        name: startApp.Name || pkg.Name,
        packageFamilyName: pkg.PackageFamilyName,
        installLocation,
        launchType: 'xbox-aumid',
        launchTarget: { aumid },
      }));
    }

    return uniqueGames(games);
  } catch { return []; }
}

function parseRegistryGames(raw) {
  const records = [];
  let current = null;
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^HKEY_/i.test(trimmed)) {
      if (current) records.push(current);
      current = { registryKey: trimmed };
      continue;
    }
    const match = line.match(/^\s+([^\s]+)\s+REG_[A-Z0-9_]+\s+(.*)$/i);
    if (current && match) current[match[1].toLowerCase()] = match[2].trim();
  }
  if (current) records.push(current);
  return records;
}

function queryRegistryTree(key) {
  if (process.platform !== 'win32') return '';
  try { return execFileSync('reg', ['query', key, '/s'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1024 * 1024 * 8 }); }
  catch { return ''; }
}

function scanGogFolders(libraryRoots) {
  const games = [];
  for (const root of platformRoots(libraryRoots,'GOG')) {
    let entries = []; try { entries = fs.readdirSync(root,{withFileTypes:true}); } catch { continue; }
    for (const directory of entries) {
      if (!directory.isDirectory()) continue;
      const folder = path.join(root,directory.name);
      let files = []; try { files = fs.readdirSync(folder); } catch { continue; }
      for (const file of files.filter(name => /^goggame-\d+\.info$/i.test(name))) {
        try {
          const info = JSON.parse(fs.readFileSync(path.join(folder,file),'utf8'));
          const tasks = asArray(info.playTasks).filter(task => task.type === 'FileTask' && (!task.category || task.category === 'game'));
          const task = tasks.find(task => task.isPrimary) || tasks[0];
          const exe = localAsset(folder,task?.path);
          if (!exe || !/\.exe$/i.test(exe)) continue;
          games.push(makeGame('gog',{id:String(info.gameId || file.match(/\d+/)[0]),name:info.name || directory.name,installLocation:folder,launchType:'gog',launchTarget:{exe,command:`"${exe}"${task.arguments ? ' '+task.arguments : ''}`,workingDir:localAsset(folder,task.workingDir) || folder}}));
        } catch { /* Unreadable or incomplete local install. */ }
      }
    }
  }
  return uniqueGames(games);
}
async function scanGogLibrary(libraryRoots) {
  if (process.platform !== 'win32') return [];
  const keys = [
    'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games',
    'HKLM\\SOFTWARE\\GOG.com\\Games',
    'HKCU\\SOFTWARE\\GOG.com\\Games',
  ];
  const records = keys.flatMap(key => parseRegistryGames(queryRegistryTree(key)));
  const games = scanGogFolders(libraryRoots);
  for (const rec of records) {
    const installLocation = cleanPathValue(rec.path || rec.installpath || rec.workingdir || '');
    const id = rec.gameid || rec.buildid || rec.registryKey?.split('\\').pop() || rec.gamename || '';
    const name = rec.gamename || rec.name || (installLocation ? path.basename(installLocation) : '');
    if (!installLocation || !fs.existsSync(installLocation)) continue;
    if (!name || !id) continue;
    games.push(makeGame('gog', {
      id,
      name,
      installLocation,
      launchType: 'gog',
      launchTarget: {
        command: cleanPathValue(rec.launchcommand || rec.launchpath || ''),
        exe: cleanPathValue(rec.exe || rec.executable || ''),
        installLocation,
        workingDir: cleanPathValue(rec.workingdir || installLocation),
      },
    }));
  }
  return uniqueGames(games);
}

async function scanEpicLibrary() {
  const candidates = [];
  if (process.platform === 'win32') {
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    candidates.push(path.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'));
  } else if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'));
  } else {
    candidates.push(path.join(os.homedir(), '.config', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'));
  }

  const games = [];
  for (const manifestsDir of candidates) {
    if (!fs.existsSync(manifestsDir)) continue;
    let entries = [];
    try { entries = fs.readdirSync(manifestsDir); } catch { continue; }
    for (const entry of entries) {
      if (!entry.toLowerCase().endsWith('.item')) continue;
      let manifest;
      try { manifest = safeJsonParse(fs.readFileSync(path.join(manifestsDir, entry), 'utf8'), null); } catch { continue; }
      if (!manifest) continue;
      if (manifest.bIsIncompleteInstall || manifest.bIsExecutable === false) continue;
      const categories = asArray(manifest.AppCategories).map(c => String(c).toLowerCase());
      if (categories.some(c => /^(software|applications|plugins|engines)(\/|$)/.test(c))) continue;
      if (manifest.MainGameAppName && manifest.AppName && manifest.MainGameAppName !== manifest.AppName) continue;
      if (!manifest.InstallLocation || !fs.existsSync(manifest.InstallLocation)) continue;
      const name = manifest.DisplayName || manifest.displayName || manifest.AppName || manifest.AppNameString || manifest.InstallLocation && path.basename(manifest.InstallLocation);
      const appName = manifest.AppName || manifest.AppId || manifest.AppIdString || '';
      const catalogItemId = manifest.CatalogItemId || manifest.MainGameCatalogItemId || '';
      const namespaceId = manifest.NamespaceId || manifest.CatalogNamespace || '';
      const id = appName || catalogItemId || manifest.InstallLocation || name;
      if (!name || !id) continue;
      games.push(makeGame('epic', {
        id,
        name,
        installLocation: manifest.InstallLocation || '',
        launchType: 'epic',
        launchTarget: {
          appName,
          catalogItemId,
          namespaceId,
          installLocation: manifest.InstallLocation || '',
          launchExecutable: manifest.LaunchExecutable || '',
          launchCommand: manifest.LaunchCommand || '',
        },
      }));
    }
  }
  return uniqueGames(games);
}


module.exports = { scanSteamLibrary, scanXboxLibrary, scanGogLibrary, scanEpicLibrary, uniqueGames, parseRegistryGames, steamArtCache, readXboxGameFolders, platformRoots, scanGogFolders };
