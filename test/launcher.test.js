const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launchPlan, splitCommand } = require('../lib/launch');
const { uniqueGames, parseRegistryGames, scanEpicLibrary, steamArtCache, readXboxGameFolders, scanGogFolders } = require('../lib/scanners');
test('registry commands preserve quoted executable paths and arguments', () => {
  assert.deepEqual(splitCommand('"C:\\GOG Games\\Game\\play.exe" -game "Some File"'), ['C:\\GOG Games\\Game\\play.exe', '-game', 'Some File']);
  assert.throws(() => splitCommand('"broken path'), /unmatched quotes/);
});
test('launch plans validate Steam identifiers and encode Epic protocol fields', () => {
  assert.deepEqual(launchPlan({ provider: 'steam', id: '123' }), { url: 'steam://run/123' });
  assert.throws(() => launchPlan({ provider: 'steam', id: '123&other' }), /Invalid/);
  assert.equal(launchPlan({ provider: 'epic', launchTarget: { appName: 'game?x', namespaceId: 'space', catalogItemId: 'item' } }).url, 'com.epicgames.launcher://apps/space%3Aitem%3Agame%3Fx?action=launch&silent=true');
  assert.throws(() => launchPlan({ provider: 'xbox', launchTarget: { aumid: 'bad & command' } }), /Invalid/);
});
test('manual executable validation rejects directories, scripts and missing files', () => {
  assert.throws(() => launchPlan({ provider: 'custom', launchTarget: { exe: os.tmpdir() } }), /missing/);
  assert.throws(() => launchPlan({ provider: 'custom', launchTarget: { exe: __filename } }), /missing/);
  assert.throws(() => launchPlan({ provider: 'custom', launchTarget: { exe: 'C:\\missing.exe' } }), /missing/);
});
test('GOG arguments survive launch planning and install folders never count as launch targets', () => {
  const exe = process.execPath;
  const plan = launchPlan({ provider: 'gog', launchTarget: { command: `"${exe}" --version`, workingDir: os.tmpdir() } });
  assert.equal(plan.exe, exe); assert.deepEqual(plan.args, ['--version']);
  assert.throws(() => launchPlan({ provider: 'gog', launchTarget: { installLocation: os.tmpdir() } }), /No executable/);
});
test('duplicates collapse within a provider but preserve copies owned in different stores', () => {
  assert.equal(uniqueGames([{provider:'steam',id:'1',name:'Game'}, {provider:'steam',id:'1',name:'Game'}, {provider:'gog',id:'1',name:'Game'}]).length, 2);
});
test('GOG registry parser keeps records and paths with spaces separate', () => {
  const records = parseRegistryGames('HKEY_LOCAL_MACHINE\\GOG\\1\n    gameName    REG_SZ    A Game\n    path    REG_SZ    C:\\GOG Games\\A Game\nHKEY_LOCAL_MACHINE\\GOG\\2\n    gameName    REG_SZ    Another');
  assert.equal(records.length, 2); assert.equal(records[0].path, 'C:\\GOG Games\\A Game'); assert.equal(records[1].gamename, 'Another');
});
test('Steam artwork resolves modern hash directories and legacy filenames', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'nexus-art-'));
  const folder = path.join(dir,'appcache','librarycache','123','aabbcc'); fs.mkdirSync(folder,{recursive:true});
  const image = path.join(folder,'library_capsule.jpg'); fs.writeFileSync(image,'fixture');
  try { assert.equal(steamArtCache(dir,'123','library_600x900'),image); assert.equal(steamArtCache(dir,'999','library_600x900'),''); }
  finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('Epic discovery skips corrupt manifests, tools, DLC, and missing installations', { skip: process.platform !== 'win32' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-scanner-'));
  const manifests = path.join(dir, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'); fs.mkdirSync(manifests, { recursive: true });
  const base = { DisplayName: 'Actual game', AppName: 'game', InstallLocation: dir, AppCategories: ['games'], bIsExecutable: true };
  const values = [base, {...base,AppName:'tool',AppCategories:['software']}, {...base,AppName:'dlc',MainGameAppName:'game'}, {...base,AppName:'missing',InstallLocation:path.join(dir,'missing')}, {...base,AppName:'plugin',bIsExecutable:false}];
  values.forEach((value,i)=>fs.writeFileSync(path.join(manifests, `${i}.item`), JSON.stringify(value)));
  fs.writeFileSync(path.join(manifests,'broken.item'), '{');
  const previous = process.env.ProgramData; process.env.ProgramData = dir;
  try { const games = await scanEpicLibrary(); assert.deepEqual(games.map(g=>g.name), ['Actual game']); }
  finally { if (previous === undefined) delete process.env.ProgramData; else process.env.ProgramData = previous; fs.rmSync(dir, {recursive:true,force:true}); }
});
test('moved Xbox installs support AppX manifests and Game.config while DLC and save folders are excluded', {skip:process.platform !== 'win32'}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'nexus-xbox-'));
  function fixture(name,manifest,file,exe) {
    const folder = path.join(root,'Xbox',name,'Content'); fs.mkdirSync(folder,{recursive:true});
    fs.writeFileSync(path.join(folder,file),manifest); if(exe) fs.writeFileSync(path.join(folder,exe),'fixture');
  }
  fixture('Racing','<Package><Identity Name="Example.Racing"/><Application Id="Game" Executable="GameLaunchHelper.exe"><uap:VisualElements DisplayName="Racing &amp; Cars" Square150x150Logo="Logo.png"/></Application></Package>','appxmanifest.xml','GameLaunchHelper.exe');
  fixture('Survivors','<Game><Identity Name="Example.Survivors"/><ShellVisuals DefaultDisplayName="Survivors"/><ExecutableList><Executable Name="survivors.exe" Id="Game"/></ExecutableList></Game>','MicrosoftGame.config','survivors.exe');
  fixture('DLC','<Game><Identity Name="Example.DLC"/><TargetDeviceFamilyForDLC>PC</TargetDeviceFamilyForDLC><DesktopRegistration><MainPackageDependency Name="Example.Survivors"/></DesktopRegistration></Game>','MicrosoftGame.config');
  fs.mkdirSync(path.join(root,'Xbox','GameSave'));
  try { const games=readXboxGameFolders([root]); assert.deepEqual(games.map(g=>g.name).sort(), ['Racing & Cars','Survivors']); assert.equal(games.find(g=>g.name==='Racing & Cars').packageName,'Example.Racing'); }
  finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('GOG manifests discover moved installs and keep their executable arguments', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'nexus-gog-'));
  const folder=path.join(root,'GOG','Games','A Game'); fs.mkdirSync(folder,{recursive:true}); fs.writeFileSync(path.join(folder,'play.exe'),'fixture');
  fs.writeFileSync(path.join(folder,'goggame-123.info'),JSON.stringify({gameId:'123',name:'A Game',playTasks:[{type:'FileTask',category:'game',isPrimary:true,path:'play.exe',arguments:'--language en'}]}));
  try { const [game]=scanGogFolders([root]); assert.equal(game.name,'A Game'); assert.deepEqual(launchPlan(game).args,['--language','en']); }
  finally {fs.rmSync(root,{recursive:true,force:true});}
});
