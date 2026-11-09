const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {readItchLibrary,parseWavedashCatalog,wavedashUrl}=require('../lib/indie-platforms');
const {launchPlan}=require('../lib/launch');
const {clientPlan,normalizeOwnedImport}=require('../lib/catalog');
test('itch cache distinguishes installs, receipts, owned bundles, browsing history, assets, and accounts without reading credentials',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-itch-')),file=path.join(folder,'butler.db'),games=path.join(folder,'apps');fs.mkdirSync(path.join(games,'installed'),{recursive:true});
 const db=new DatabaseSync(file);
 db.exec(`CREATE TABLE games(id INTEGER,title TEXT,cover_url TEXT,still_cover_url TEXT,classification TEXT);CREATE TABLE install_locations(id TEXT,path TEXT);CREATE TABLE caves(id TEXT,game_id INTEGER,installed_size INTEGER,install_folder_name TEXT,custom_install_folder TEXT,installed_at TEXT,install_location_id TEXT);CREATE TABLE profiles(id INTEGER,user_id INTEGER,api_key TEXT);CREATE TABLE download_keys(game_id INTEGER,owner_id INTEGER);CREATE TABLE bundle_keys(bundle_id INTEGER,owner_id INTEGER);CREATE TABLE bundle_games(bundle_id INTEGER,game_id INTEGER);INSERT INTO profiles VALUES(1,101,'secret-one'),(2,202,'secret-two');INSERT INTO games VALUES(10,'Installed owned game',NULL,NULL,'game'),(20,'Only browsed',NULL,NULL,'game'),(30,'Owned bundle game',NULL,NULL,'game'),(40,'Other account',NULL,NULL,'game'),(50,'Art asset',NULL,NULL,'game_asset');INSERT INTO download_keys VALUES(10,101),(40,202),(50,101);INSERT INTO bundle_keys VALUES(1,101);INSERT INTO bundle_games VALUES(1,30);`);
 db.prepare('INSERT INTO install_locations VALUES(?,?)').run('root',games);db.prepare('INSERT INTO caves VALUES(?,?,?,?,?,?,?)').run('cave',10,1000000000,'installed','','2026-11-07','root');db.prepare('INSERT INTO caves VALUES(?,?,?,?,?,?,?)').run('stale',20,0,'missing','','2026-11-07','root');db.close();
 const before=fs.readFileSync(file);
 try{const undecided=readItchLibrary(file);assert.equal(undecided.needsAccount,true);assert.equal(undecided.installed.length,1);assert.equal(undecided.owned.length,0);const selected=readItchLibrary(file,'1');assert.deepEqual(selected.owned.map(game=>game.id).sort(),['10','30']);assert.equal(selected.installed[0].sizeGb,'1.0');assert(!JSON.stringify(selected).includes('secret'));assert.deepEqual(fs.readFileSync(file),before);}finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('Wavedash catalog parses official game cards, preserves punctuation, rejects tag/foreign routes and does not imply ownership',()=>{
 const html=`<a href="/games/a-game"><img src="https://uploads.wavedash.com/a.webp" alt="A &amp; B"></a><a href="/games/old-mans-journey"><img alt="Old Man's Journey" src="https://uploads.wavedash.com/b.webp"></a><a href="/games/a-game"><img alt="Duplicate"></a><a href="/games/tags/racing"><img alt="Tag"></a><a href="https://evil.example/games/evil"><img alt="External"></a>`;
 const games=parseWavedashCatalog(html);assert.equal(games.length,2);assert.equal(games[0].name,'A & B');assert.equal(games[1].name,"Old Man's Journey");assert(games.every(game=>game.web&&!game.installed&&!game.owned));
 assert.equal(wavedashUrl('https://wavedash.com/games/A-GAME?tracking=1'),'https://wavedash.com/games/a-game');assert.throws(()=>wavedashUrl('https://wavedash.com.evil.example/games/a'));assert.throws(()=>wavedashUrl('https://user:pass@wavedash.com/games/a'));assert.throws(()=>wavedashUrl('file:///games/a'));assert.throws(()=>wavedashUrl('https://wavedash.com/games/tags/racing'));
});
test('itch and Wavedash launch plans use fixed validated routes, never imported launch commands',()=>{
 assert.deepEqual(launchPlan({provider:'wavedash',id:'a-game',webUrl:'https://evil.example'}),{url:'https://wavedash.com/games/a-game'});assert.throws(()=>launchPlan({provider:'wavedash',id:'../evil'}));assert.throws(()=>launchPlan({provider:'itch',id:'1&evil'}));
 assert.deepEqual(clientPlan({provider:'itch',id:'123'}),{url:'itch://install?game_id=123'});
 const [game]=normalizeOwnedImport({games:[{provider:'itch',id:'123',name:'An itch game',launchTarget:{exe:'bad.exe'}}]});assert.equal(game.launchTarget,undefined);
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-itch-launch-')),previous=process.env.LOCALAPPDATA;process.env.LOCALAPPDATA=folder;
 try{assert.deepEqual(launchPlan({provider:'itch',id:'123'}),{url:'itch://install?game_id=123&launch'});fs.mkdirSync(path.join(folder,'itch'));fs.writeFileSync(path.join(folder,'itch','itch-setup.exe'),'fixture');if(process.platform==='win32')assert.deepEqual(launchPlan({provider:'itch',id:'123'}).args,['--appname','itch','--run-game','123']);else assert.deepEqual(launchPlan({provider:'itch',id:'123'}),{url:'itch://install?game_id=123&launch'});}finally{if(previous===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=previous;fs.rmSync(folder,{recursive:true,force:true});}
});
