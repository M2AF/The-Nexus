'use strict';
const {_electron:electron}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let application;
(async()=>{
 const executablePath=path.resolve(root,process.env.NEXUS_SMOKE_EXECUTABLE||(process.platform==='win32'?'dist/win-unpacked/The Nexus.exe':'dist/linux-unpacked/the-nexus'));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-ci-smoke-'));
 // Synthetic local data prevents library scans, account restoration and store requests.
 fs.writeFileSync(path.join(profile,'library.json'),JSON.stringify({games:[{provider:'steam',id:'1',name:'Nexus build verification'}],favorites:[],history:{},scanRevision:5,lastScan:new Date().toISOString()}));
 application=await electron.launch({executablePath,args:process.platform==='linux'?['--no-sandbox']:[],env:{...process.env,NEXUS_TEST_DATA:profile}});
 const page=await application.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.getByRole('button',{name:'Nexus build verification',exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>window.nexus.read())).games.length,1);
 await page.locator('#settings').click();await page.locator('#settings-dialog[open]').waitFor();
 const appearance=await page.evaluate(()=>window.nexus.logo());assert.equal(appearance.logoVariant,'blue');
 await page.locator('#settings-dialog .close').click();
 await page.locator('#list-view').click();assert(await page.locator('#games').evaluate(el=>el.classList.contains('list-mode')));
 assert.equal(await page.locator('[data-discover-group=free]').count(),1);
 fs.mkdirSync(path.join(root,'dist'),{recursive:true});
 await page.screenshot({path:path.join(root,'dist',`smoke-${process.platform}.png`)});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(root,'dist',`smoke-${process.platform}.json`),JSON.stringify({platform:process.platform,version:require('../package.json').version,commit:process.env.GITHUB_SHA||null,packaged:true,ipc:true,library:true,settings:true,listMode:true,errors},null,2));
 console.log(`Packaged ${process.platform} startup, renderer, IPC and settings checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(application)await application.close();});
