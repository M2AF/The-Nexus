const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Installations,steamState,readSteamState}=require('../lib/installations');
const acf=(flags,downloaded=0,total=1000,extra='')=>`"AppState" { "appid" "123" "StateFlags" "${flags}" "installdir" "Example" "BytesDownloaded" "${downloaded}" "BytesToDownload" "${total}" ${extra} }`;
test('Steam progress distinguishes transfer, pause, verification, updates and completed files',()=>{
 assert.equal(steamState(acf(1024,300),()=>true,'/steam').progress,30);
 assert.equal(steamState(acf(512,300),()=>true,'/steam').status,'paused');
 assert.equal(steamState(acf(256,1000,1000,'"BytesToStage" "2000" "BytesStaged" "1000"'),()=>true,'/steam').progress,50);
 assert.equal(steamState(acf(4,1000),()=>true,'/steam').status,'installed');
 assert.notEqual(steamState(acf(4,1000),()=>false,'/steam').status,'installed');
 assert.equal(steamState(acf(6,1000),()=>true,'/steam').status,'update-required');
 assert.equal(steamState('"appid" "123" "StateFlags" "1024"').progress,null);
 assert.equal(steamState('garbage'),null);assert.throws(()=>readSteamState('../file',[]));
});
test('Owned install requests coalesce, observe actual Steam bytes, survive restart and refresh library once',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-install-')),folder=path.join(directory,'steamapps');fs.mkdirSync(path.join(folder,'common','Example'),{recursive:true});let opened=0,completed=0,now=1000;
 const options={directory,openClient:async()=>{opened++;},steamFolders:()=>[folder],onInstalled:async()=>{completed++;},now:()=>now};const manager=new Installations(options),game={provider:'steam',id:'123',name:'Example',owned:true,installed:false};
 try{fs.writeFileSync(path.join(folder,'appmanifest_123.acf'),acf(1024,100));await Promise.all([manager.request(game),manager.request(game)]);assert.equal(opened,1);assert.equal(manager.snapshot().jobs[0].progress,10);
 now=2000;fs.writeFileSync(path.join(folder,'appmanifest_123.acf'),acf(1024,300));await manager.poll();assert.equal(manager.snapshot().jobs[0].speed,200);assert.equal(manager.snapshot().jobs[0].eta,3.5);
 const resumed=new Installations(options);assert.equal(resumed.snapshot().jobs[0].progress,null);assert.equal(resumed.snapshot().jobs[0].speed,undefined);await resumed.poll();assert.equal(resumed.snapshot().jobs[0].progress,30);
 now=3000;fs.writeFileSync(path.join(folder,'appmanifest_123.acf'),acf(4,1000));await manager.poll();await manager.poll();assert.equal(completed,1);assert.equal(manager.snapshot().active,0);assert.equal(manager.snapshot().jobs[0].status,'installed');manager.remove('steam:123');assert.equal(manager.snapshot().jobs.length,0);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Unowned, installed and invalid games are rejected; client failures create no fake downloads',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-install-'));const manager=new Installations({directory,openClient:async()=>{throw Error('Client missing');}});
 try{for(const game of [{provider:'steam',id:'123',owned:false},{provider:'steam',id:'123',owned:true,installed:true},{provider:'steam',id:'../123',owned:true}])await assert.rejects(manager.request(game));await assert.rejects(manager.request({provider:'steam',id:'123',name:'Example',owned:true}),/Client missing/);assert.equal(manager.snapshot().jobs.length,0);}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Other client transfers stay unknown until a real installation is discovered',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-install-'));let library=[];const manager=new Installations({directory,openClient:async()=>{},library:()=>library});
 try{await manager.request({provider:'gog',id:'456',name:'Example',owned:true});assert.equal(manager.snapshot().jobs[0].progress,null);assert.equal(manager.snapshot().jobs[0].status,'waiting');library=[{provider:'gog',id:'456',installed:true}];await manager.poll();assert.equal(manager.snapshot().jobs[0].status,'installed');}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
