const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {readGalaxyLibrary,mergeLibraries,normalizeOwnedImport,clientPlan}=require('../lib/catalog');
test('owned records merge with installed games without treating every local executable as owned',()=>{
 const installed=[{provider:'steam',id:'10',name:'A Game'},{provider:'xbox',id:'Package!App',name:'Racing'},{provider:'custom',id:'local',name:'A local tool'}];
 const owned=[{provider:'steam',id:'10',name:'A Game',ownershipSource:'Galaxy'},{provider:'steam',id:'20',name:'Other Game'},{provider:'xbox',id:'12345',name:'Racing'}];
 const games=mergeLibraries(installed,owned);
 assert.equal(games.length,4);assert.equal(games.filter(game=>game.installed).length,3);assert.equal(games.filter(game=>game.owned).length,3);
 assert.equal(games.find(game=>game.name==='Racing').key,'xbox:Package!App');assert.equal(games.find(game=>game.name==='Other Game').installed,false);assert.equal(games.find(game=>game.provider==='custom').owned,false);
});
test('imports accept Steam JSON and discard launch commands, credentials, and untrusted artwork',()=>{
 const [game]=normalizeOwnedImport({response:{games:[{appid:10,name:'A Game',launchTarget:{exe:'malware.exe'},token:'secret',portrait:'https://evil.example/tracker.jpg'}]}});
 assert.equal(game.provider,'steam');assert.equal(game.id,'10');assert.equal(game.launchTarget,undefined);assert.equal(game.token,undefined);assert.equal(game.portrait,undefined);
 assert.throws(()=>normalizeOwnedImport({games:[{provider:'steam',id:'1&x',name:'Bad'}]}),/numeric/);
 assert.throws(()=>normalizeOwnedImport({games:[{provider:'unknown',id:'1',name:'Bad'}]}),/supported/);
 assert.deepEqual(clientPlan({provider:'steam',id:'10'}),{url:'steam://install/10'});
 assert.throws(()=>clientPlan({provider:'steam',id:'10?x'}),/supported/);
});
test('Galaxy import is read-only and includes licensed visible games, not DLC or unlicensed catalog entries',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-owned-')),file=path.join(folder,'galaxy.db');
 const database=new DatabaseSync(file);
 database.exec(`CREATE TABLE LibraryReleases(id INTEGER,userId INTEGER,releaseKey TEXT);CREATE TABLE LicensedReleases(libraryId INTEGER,isOwned INTEGER);CREATE TABLE ReleaseProperties(releaseKey TEXT,isDlc INTEGER,isVisibleInLibrary INTEGER);CREATE TABLE GamePieceTypes(id INTEGER,type TEXT);CREATE TABLE GamePieces(releaseKey TEXT,gamePieceTypeId INTEGER,userId INTEGER,value TEXT);CREATE TABLE GamePieceCacheUpdateDates(userId INTEGER,updateDate TEXT);INSERT INTO GamePieceTypes VALUES(1,'title'),(2,'originalImages');INSERT INTO LibraryReleases VALUES(1,123,'steam_10'),(2,123,'gog_20'),(3,123,'steam_30'),(4,123,'gog_40');INSERT INTO LicensedReleases VALUES(1,1),(2,1),(3,0),(4,1);INSERT INTO ReleaseProperties VALUES('gog_20',1,1),('gog_40',0,0);INSERT INTO GamePieceCacheUpdateDates VALUES(123,'2026-11-07');`);
 database.prepare('INSERT INTO GamePieces VALUES(?,?,?,?)').run('steam_10',1,null,JSON.stringify({title:'Owned game'}));database.close();
 const before=fs.readFileSync(file);
 try {const result=readGalaxyLibrary(file);assert.deepEqual(result.games.map(game=>game.name),['Owned game']);assert.equal(result.updatedAt,'2026-11-07');assert.deepEqual(fs.readFileSync(file),before);}
 finally {fs.rmSync(folder,{recursive:true,force:true});}
});
