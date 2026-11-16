const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {Updater,RELEASE_API,isNewer,selectRelease,parseChecksum,installTarget,relaunchEnv,trustedDownload}=require('../lib/updater');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const release=(version,extra={})=>{const name=`The-Nexus-${version}-portable.exe`;return {tag_name:'v'+version,draft:false,prerelease:false,html_url:`https://github.com/M2AF/The-Nexus/releases/tag/v${version}`,assets:[{name,size:2e6,browser_download_url:`https://github.com/M2AF/The-Nexus/releases/download/v${version}/${name}`},{name:name+'.sha256',size:90,browser_download_url:`https://github.com/M2AF/The-Nexus/releases/download/v${version}/${name}.sha256`}],...extra};};
function response(status,body,headers={}){const bytes=typeof body==='string'?Buffer.from(body):body;return {status,ok:status>=200&&status<300,headers:{get:name=>headers[name.toLowerCase()]??(name.toLowerCase()==='content-length'?String(bytes.length):null)},text:async()=>bytes.toString(),body:(async function*(){for(let i=0;i<bytes.length;i+=65536)yield bytes.subarray(i,i+65536);})()};}

test('updater compares numeric versions and ignores drafts, prereleases and older tags',()=>{
 assert(isNewer('0.10.0','0.9.5'));assert(!isNewer('0.9.5','0.9.5'));assert(!isNewer('0.9.4','0.9.5'));assert(!isNewer('1.0.0-beta','0.9.5'));
 assert.equal(selectRelease(release('0.9.5'),{currentVersion:'0.9.5',platform:'win32'}),null);
 assert.equal(selectRelease(release('1.0.0',{draft:true}),{currentVersion:'0.9.5',platform:'win32'}),null);
 assert.equal(selectRelease(release('1.0.0',{prerelease:true}),{currentVersion:'0.9.5',platform:'win32'}),null);
 const chosen=selectRelease(release('1.0.0'),{currentVersion:'0.9.5',platform:'win32'});assert.equal(chosen.version,'1.0.0');assert.equal(chosen.asset.name,'The-Nexus-1.0.0-portable.exe');
});
test('updater only trusts GitHub downloads with a matching checksum asset for this platform',()=>{
 assert.equal(selectRelease(release('1.0.0'),{currentVersion:'0.9.5',platform:'linux'}).asset,null);
 const foreign=release('1.0.0');foreign.assets[0].browser_download_url='https://example.com/The-Nexus.exe';assert.equal(selectRelease(foreign,{currentVersion:'0.9.5',platform:'win32'}).asset,null);
 const noSum=release('1.0.0');noSum.assets.pop();assert.equal(selectRelease(noSum,{currentVersion:'0.9.5',platform:'win32'}).asset,null);
 const page=release('1.0.0',{html_url:'https://evil.example/releases'});assert.equal(selectRelease(page,{currentVersion:'0.9.5',platform:'win32'}).page,'https://github.com/M2AF/The-Nexus/releases/tag/v1.0.0');
 assert(trustedDownload('https://release-assets.githubusercontent.com/x'));assert(!trustedDownload('http://github.com/x'));assert(!trustedDownload('https://github.com:8443/x'));
 assert.equal(parseChecksum('a'.repeat(64)+'  The-Nexus-1.0.0-portable.exe\n','The-Nexus-1.0.0-portable.exe'),'a'.repeat(64));assert.equal(parseChecksum('a'.repeat(64)+'  other.exe','The-Nexus-1.0.0-portable.exe'),null);
});
test('only packaged portable and AppImage builds replace themselves',()=>{
 assert.equal(installTarget({packaged:false,platform:'win32',env:{PORTABLE_EXECUTABLE_FILE:'C:\\Games\\Nexus.exe'}}),null);
 assert.equal(installTarget({packaged:true,platform:'win32',env:{}}),null);
 assert.equal(installTarget({packaged:true,platform:'linux',env:{APPIMAGE:'/home/me/Nexus.AppImage'}}).kind,'appimage');
 const env=relaunchEnv({APPDIR:'/tmp/.mount_x',APPIMAGE:'/a',LD_LIBRARY_PATH:'/tmp/.mount_x/usr/lib:/opt/lib',PORTABLE_EXECUTABLE_FILE:'C:\\x.exe',HOME:'/home/me'});
 assert.deepEqual(env,{LD_LIBRARY_PATH:'/opt/lib',HOME:'/home/me'});
});
test('updater downloads, verifies and swaps the portable executable, keeping the old file as .old',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-update-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const exe=path.join(dir,'The Nexus.exe');fs.writeFileSync(exe,'old build');const payload=crypto.randomBytes(2e6),info=release('1.0.0');
 const fetchImpl=async url=>{if(url===RELEASE_API)return response(200,JSON.stringify(info));if(url.endsWith('.sha256'))return response(200,`${sha(payload)}  The-Nexus-1.0.0-portable.exe\n`);if(url.endsWith('.exe'))return response(302,'',{location:'https://release-assets.githubusercontent.com/github-production-release-asset/1'});if(url.startsWith('https://release-assets.'))return response(200,payload);throw Error('unexpected '+url);};
 const seen=[];const updater=new Updater({currentVersion:'0.9.5',platform:'win32',target:{kind:'portable',file:exe},fetchImpl,onChange:s=>seen.push(s.status)});
 const state=await updater.check({manual:true});assert.equal(state.status,'downloading');assert.equal(state.version,'1.0.0');await updater.download;
 assert.equal(updater.public().status,'ready');assert(seen.includes('downloading'));
 const plan=updater.install();assert.equal(plan.action,'relaunch');assert.equal(plan.file,exe);
 assert.deepEqual(fs.readFileSync(exe),payload);assert.equal(fs.readFileSync(exe+'.old','utf8'),'old build');
 updater.cleanup();assert(!fs.existsSync(exe+'.old'));
});
test('updater rejects a download whose checksum does not match and leaves the executable alone',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-update-bad-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const exe=path.join(dir,'The Nexus.exe');fs.writeFileSync(exe,'old build');const payload=crypto.randomBytes(2e6);
 const fetchImpl=async url=>url===RELEASE_API?response(200,JSON.stringify(release('1.0.0'))):url.endsWith('.sha256')?response(200,`${'0'.repeat(64)}  The-Nexus-1.0.0-portable.exe`):response(200,payload);
 const updater=new Updater({currentVersion:'0.9.5',platform:'win32',target:{kind:'portable',file:exe},fetchImpl});
 await updater.check();await updater.download;
 assert.equal(updater.public().status,'error');assert.match(updater.public().message,/SHA-256/);
 assert.equal(fs.readFileSync(exe,'utf8'),'old build');assert.deepEqual(fs.readdirSync(dir),['The Nexus.exe']);assert.throws(()=>updater.install(),/No downloaded update/);
});
test('development builds report a newer release and open its page instead of downloading',async()=>{
 const updater=new Updater({currentVersion:'0.9.5',platform:'win32',target:null,fetchImpl:async()=>response(200,JSON.stringify(release('1.0.0')))});
 const state=await updater.check();assert.equal(state.status,'available');assert.equal(state.installable,false);assert.equal(updater.download,null);
 assert.deepEqual(updater.install(),{action:'open',url:'https://github.com/M2AF/The-Nexus/releases/tag/v1.0.0'});
});
const setupRelease=version=>{const info=release(version),name=`The-Nexus-${version}-setup.exe`;info.assets.push({name,size:2e6,browser_download_url:`https://github.com/M2AF/The-Nexus/releases/download/v${version}/${name}`},{name:name+'.sha256',size:90,browser_download_url:`https://github.com/M2AF/The-Nexus/releases/download/v${version}/${name}.sha256`});return info;};
test('NSIS installations are recognised by their uninstaller; unpacked folders and portable builds are not',()=>{
 const execPath='C:\\Users\\me\\AppData\\Local\\Programs\\the-nexus-launcher\\The Nexus.exe',env={LOCALAPPDATA:'C:\\Users\\me\\AppData\\Local'},seen=[];
 const target=installTarget({packaged:true,platform:'win32',env,execPath,exists:file=>{seen.push(file);return true;}});
 assert.deepEqual(target,{kind:'installed',file:execPath,downloadDir:'C:\\Users\\me\\AppData\\Local\\the-nexus-updater'});
 assert.deepEqual(seen,['C:\\Users\\me\\AppData\\Local\\Programs\\the-nexus-launcher\\Uninstall The Nexus.exe']);
 assert.equal(installTarget({packaged:true,platform:'win32',env,execPath:'C:\\build\\win-unpacked\\The Nexus.exe',exists:()=>false}),null);
 assert.equal(installTarget({packaged:true,platform:'win32',env:{},execPath,exists:()=>true}),null);
 assert.equal(installTarget({packaged:false,platform:'win32',env,execPath,exists:()=>true}),null);
 assert.equal(installTarget({packaged:true,platform:'win32',env,execPath,exists:()=>{throw Error('denied');}}),null);
 // The portable stub also runs from a folder; its permanent executable always wins.
 assert.equal(installTarget({packaged:true,platform:'win32',env:{...env,PORTABLE_EXECUTABLE_FILE:'C:\\Games\\The Nexus.exe'},execPath,exists:()=>true}).kind,'portable');
});
test('installed builds select the setup asset while portable builds keep the portable asset',()=>{
 const info=setupRelease('1.0.0');
 assert.equal(selectRelease(info,{currentVersion:'0.9.5',platform:'win32',kind:'installed'}).asset.name,'The-Nexus-1.0.0-setup.exe');
 assert.equal(selectRelease(info,{currentVersion:'0.9.5',platform:'win32',kind:'portable'}).asset.name,'The-Nexus-1.0.0-portable.exe');
 assert.equal(selectRelease(release('1.0.0'),{currentVersion:'0.9.5',platform:'win32',kind:'installed'}).asset,null);
 const foreign=setupRelease('1.0.0');foreign.assets[2].browser_download_url='https://example.com/setup.exe';assert.equal(selectRelease(foreign,{currentVersion:'0.9.5',platform:'win32',kind:'installed'}).asset,null);
});
test('installed builds download and verify the setup outside the install folder, then run it silently',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-update-installed-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const installDir=path.join(root,'Programs'),downloadDir=path.join(root,'the-nexus-updater');fs.mkdirSync(installDir);
 const exe=path.join(installDir,'The Nexus.exe');fs.writeFileSync(exe,'installed build');const payload=crypto.randomBytes(2e6),info=setupRelease('1.0.0'),requested=[];
 const fetchImpl=async url=>{requested.push(url);if(url===RELEASE_API)return response(200,JSON.stringify(info));if(url.endsWith('setup.exe.sha256'))return response(200,`${sha(payload)}  The-Nexus-1.0.0-setup.exe\n`);if(url.endsWith('setup.exe'))return response(200,payload);throw Error('unexpected '+url);};
 const updater=new Updater({currentVersion:'0.9.5',platform:'win32',target:{kind:'installed',file:exe,downloadDir},fetchImpl});
 await updater.check({manual:true});await updater.download;assert.equal(updater.public().status,'ready');
 assert(!requested.some(url=>url.includes('portable')));
 const setup=path.join(downloadDir,'The-Nexus-update-1.0.0-setup.exe');assert.deepEqual(fs.readFileSync(setup),payload);
 assert.deepEqual(fs.readdirSync(installDir),['The Nexus.exe']);
 const plan=updater.install();
 assert.equal(plan.action,'relaunch');assert.equal(plan.file,setup);assert.deepEqual(plan.args,['/S','--updated','--force-run']);
 assert.equal(fs.readFileSync(exe,'utf8'),'installed build');assert.equal(updater.public().status,'restarting');
 // A setup that cannot be started leaves the verified download ready for another try.
 updater.relaunchFailed(Error('blocked'));assert.equal(updater.public().status,'ready');assert.equal(updater.install().file,setup);
 // The next launch removes the used setup and abandoned partial downloads.
 fs.writeFileSync(path.join(downloadDir,'.The-Nexus-update-1.0.1.partial'),'x');fs.writeFileSync(path.join(downloadDir,'keep.txt'),'x');
 updater.cleanup();assert.deepEqual(fs.readdirSync(downloadDir),['keep.txt']);
});
test('installed builds reject a setup whose checksum does not match',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-update-installed-bad-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const downloadDir=path.join(root,'the-nexus-updater'),exe=path.join(root,'The Nexus.exe');fs.writeFileSync(exe,'installed build');
 const fetchImpl=async url=>url===RELEASE_API?response(200,JSON.stringify(setupRelease('1.0.0'))):url.endsWith('.sha256')?response(200,`${'0'.repeat(64)}  The-Nexus-1.0.0-setup.exe`):response(200,crypto.randomBytes(2e6));
 const updater=new Updater({currentVersion:'0.9.5',platform:'win32',target:{kind:'installed',file:exe,downloadDir},fetchImpl});
 await updater.check();await updater.download;
 assert.equal(updater.public().status,'error');assert.match(updater.public().message,/SHA-256/);assert.deepEqual(fs.readdirSync(downloadDir),[]);assert.throws(()=>updater.install(),/No downloaded update/);
});
