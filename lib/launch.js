const fs = require('node:fs');
const path = require('node:path');

// Registry commands may contain quoted paths and arguments. Never invoke a shell.
function splitCommand(command) {
  const parts = [];
  let word = '', quoted = false, started = false;
  for (const c of String(command || '')) {
    if (c === '"') { quoted = !quoted; started = true; }
    else if (/\s/.test(c) && !quoted) { if (started) parts.push(word); word = ''; started = false; }
    else { word += c; started = true; }
  }
  if (quoted) throw new Error('The game launch command has unmatched quotes.');
  if (started) parts.push(word);
  return parts;
}

function launchPlan(game) {
  const target = game.launchTarget || {};
  if(game.provider==='wavedash'){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(game.id)))throw new Error('Invalid Wavedash game link.');
    return {url:`https://wavedash.com/games/${game.id}`};
  }
  if(game.provider==='itch'){
    if(!/^\d+$/.test(String(game.id)))throw new Error('Invalid itch.io game ID.');
    const setup=path.join(process.env.LOCALAPPDATA||path.join(require('node:os').homedir(),'AppData','Local'),'itch','itch-setup.exe');
    return fs.existsSync(setup)?checkedExecutable(setup,['--appname','itch','--run-game',String(game.id)],path.dirname(setup)):{url:`itch://install?game_id=${game.id}&launch`};
  }
  if (game.provider === 'steam') {
    if (!/^\d+$/.test(String(game.appId || game.id))) throw new Error('Invalid Steam game ID.');
    return { url: `steam://run/${game.appId || game.id}` };
  }
  if (game.provider === 'epic') {
    if (!target.appName) throw new Error('Epic launch information is missing. Rescan your library.');
    const id = target.namespaceId && target.catalogItemId
      ? [target.namespaceId, target.catalogItemId, target.appName].map(encodeURIComponent).join('%3A')
      : encodeURIComponent(target.appName);
    return { url: `com.epicgames.launcher://apps/${id}?action=launch&silent=true` };
  }
  if (game.provider === 'xbox') {
    if (!/^[\w.\-]+![\w.\-]+$/.test(target.aumid || '')) throw new Error('Invalid Xbox launch ID.');
    return { exe: 'explorer.exe', args: [`shell:AppsFolder\\${target.aumid}`] };
  }
  if (game.provider === 'custom') return checkedExecutable(target.exe, [], path.dirname(target.exe));
  if (game.provider === 'gog') {
    if (/^goggalaxy:\/\//i.test(target.command || '')) return { url: target.command };
    const raw = String(target.command || '');
    if (raw && fs.existsSync(raw)) return checkedExecutable(raw, [], target.workingDir);
    const [exe, ...args] = splitCommand(raw);
    if (exe && fs.existsSync(exe)) return checkedExecutable(exe, args, target.workingDir);
    const fallback = target.exe && (path.isAbsolute(target.exe) ? target.exe : path.join(target.installLocation || '', target.exe));
    if (fallback && fs.existsSync(fallback)) return checkedExecutable(fallback, [], target.workingDir);
    throw new Error('No executable found for this GOG game. Add its executable with Add game.');
  }
  throw new Error('Unsupported game provider.');
}
function checkedExecutable(exe, args, cwd) {
  if (!exe || !path.isAbsolute(exe) || !/\.(exe|lnk)$/i.test(exe) || !fs.existsSync(exe) || !fs.statSync(exe).isFile()) {
    throw new Error('Game executable is missing. Locate it again with Add game.');
  }
  return { exe, args, cwd: cwd && fs.existsSync(cwd) && fs.statSync(cwd).isDirectory() ? cwd : path.dirname(exe) };
}
module.exports = { splitCommand, launchPlan };
