const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const providers = {steam:'Steam',gog:'GOG',epic:'Epic Games',xbox:'Xbox',itch:'itch.io',battlenet:'Battle.net'};
function artworkUrl(value) {
  if(require('./battlenet').artwork(value))return value;
  try {const url=new URL(value); return url.protocol==='https:' && !url.username && !url.password && (['images.gog.com','cdn.cloudflare.steamstatic.com','shared.fastly.steamstatic.com','img.itch.zone','img.itch.io','uploads.wavedash.com'].includes(url.hostname) || /^(images|images-\d)\.gog-statics\.com$/.test(url.hostname)) ? url.href : undefined;} catch {return undefined;}
}
function parse(value) {try{return JSON.parse(value);}catch{return {};}}
function readGalaxyLibrary(databasePath, accountId) {
  if (!fs.existsSync(databasePath)) return {available:false,games:[],message:'GOG Galaxy library cache was not found. Sync your accounts in Galaxy, or import a library file.'};
  const database=new DatabaseSync(databasePath,{readOnly:true});
  try {
    database.exec('PRAGMA busy_timeout=2000');
    const accounts=database.prepare('SELECT DISTINCT CAST(userId AS TEXT) id FROM LibraryReleases').all();
    if (accounts.length!==1 && !accounts.some(account=>account.id===accountId)) return {available:true,accounts,games:[],needsAccount:true,message:'Choose a cached Galaxy account to import. Accounts are kept separate.'};
    const id=accountId || accounts[0]?.id;
    if (!id) return {available:false,games:[],message:'Galaxy has no synced account library yet.'};
    const rows=database.prepare(`SELECT DISTINCT l.releaseKey FROM LibraryReleases l JOIN LicensedReleases own ON own.libraryId=l.id LEFT JOIN ReleaseProperties p ON p.releaseKey=l.releaseKey WHERE l.userId=? AND own.isOwned=1 AND COALESCE(p.isDlc,0)=0 AND COALESCE(p.isVisibleInLibrary,1)=1`).all(id);
    const pieces=database.prepare(`SELECT g.releaseKey,t.type,g.value FROM GamePieces g JOIN GamePieceTypes t ON t.id=g.gamePieceTypeId WHERE t.type IN ('title','originalImages') AND (g.userId IS NULL OR g.userId=?) ORDER BY g.userId IS NOT NULL`).all(id);
    const metadata=new Map();
    for(const piece of pieces){const item=metadata.get(piece.releaseKey)||{};item[piece.type]=parse(piece.value);metadata.set(piece.releaseKey,item);}
    const games=[];
    for(const row of rows){
      const separator=row.releaseKey.indexOf('_'),platform=row.releaseKey.slice(0,separator),externalId=row.releaseKey.slice(separator+1);
      const provider=platform==='xboxone'?'xbox':['battle.net','blizzard'].includes(platform)?'battlenet':platform;
      if(!providers[provider] || !externalId)continue;
      const meta=metadata.get(row.releaseKey)||{},name=meta.title?.title;
      if(!name)continue;
      const battle=provider==='battlenet'?(require('./battlenet').product(externalId)||require('./battlenet').products.find(p=>normalizedName(p.title)===normalizedName(name))):null;if(provider==='battlenet'&&!battle)continue;
      games.push({provider,providerLabel:providers[provider],id:provider==='battlenet'?battle.id:externalId,name,owned:true,installed:false,ownershipSource:'GOG Galaxy',sourcePlatform:platform,portrait:artworkUrl(meta.originalImages?.verticalCover)||battle?.portrait,header:artworkUrl(meta.originalImages?.background)||battle?.portrait});
    }
    const updated=database.prepare('SELECT updateDate FROM GamePieceCacheUpdateDates WHERE userId=?').get(id)?.updateDate || null;
    return {available:true,games,accounts,accountId:id,updatedAt:updated,importedAt:new Date().toISOString(),counts:games.reduce((counts,game)=>(counts[game.provider]=(counts[game.provider]||0)+1,counts),{})};
  } finally {database.close();}
}
function normalizedName(name){return String(name).normalize('NFKC').toLowerCase().replace(/[™®©]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();}
function mergeLibraries(installed,owned){
  const result=installed.map(game=>({...game,installed:true,owned:false,key:`${game.provider}:${game.id}`}));
  const exact=new Map(result.map(game=>[game.key,game])),names=new Map(),counts=new Map(),unique=new Map();
  const nameKey=game=>`${game.provider}:${normalizedName(game.name)}`;
  for(const game of result){const key=nameKey(game);names.set(key,[...(names.get(key)||[]),game]);}
  for(const record of owned){const key=`${record.provider}:${record.id}`;if(!unique.has(key))unique.set(key,record);}
  for(const record of unique.values()){const key=nameKey(record);counts.set(key,(counts.get(key)||0)+1);}
  for(const record of unique.values()){
    const key=`${record.provider}:${record.id}`;
    let match=exact.get(key);
    if(!match){const candidates=names.get(nameKey(record)) || [];if(candidates.length===1 && counts.get(nameKey(record))===1)match=candidates[0];}
    if(match){match.owned=true;match.ownershipSource=record.ownershipSource;match.catalogId=record.id;if(!match.portrait?.startsWith('data:'))match.portrait=record.portrait||match.portrait;if(!match.header?.startsWith('data:'))match.header=record.header||match.header;}
    else {const game={...record,installed:false,owned:true,key};result.push(game);exact.set(key,game);}
  }
  return result;
}
function normalizeOwnedImport(data){
  const records=Array.isArray(data)?data:data.games || data.response?.games;
  if(!Array.isArray(records)||records.length>20000)throw new Error('Use a JSON library with a games array (up to 20,000 entries).');
  const games=[],seen=new Set();
  for(const record of records){
    const rawProvider=String(record.provider || (record.appid?'steam':''));const provider=['battle.net','blizzard','bnet'].includes(rawProvider)?'battlenet':rawProvider;
    let id=String(record.id || record.appid || '');const name=String(record.name||record.title||'').trim();
    if(!providers[provider]||!id||id.length>200||!name||name.length>500)throw new Error('Each game needs a supported provider, stable platform id, and name.');
    if(['steam','gog','itch'].includes(provider)&&!/^\d+$/.test(id))throw new Error('Steam, GOG and itch.io records need numeric platform ids.');
    if(provider==='battlenet'){const p=require('./battlenet').product(id);if(!p)throw Error('Use a supported Battle.net product ID.');id=p.id;}
    const key=`${provider}:${id}`;if(seen.has(key))continue;seen.add(key);
    games.push({provider,providerLabel:providers[provider],id,name,owned:true,installed:false,ownershipSource:'Library file',portrait:artworkUrl(record.portrait)||(provider==='battlenet'?require('./battlenet').product(id)?.portrait:undefined),header:artworkUrl(record.header)||(provider==='battlenet'?require('./battlenet').product(id)?.portrait:undefined)});
  }
  return games;
}
function clientPlan(game){
  if(game.provider==='battlenet')return require('./battlenet').install(String(game.catalogId||game.id));
  if(game.provider==='itch' && /^\d+$/.test(game.catalogId||game.id))return {url:`itch://install?game_id=${game.catalogId||game.id}`};
  if(game.provider==='steam' && /^\d+$/.test(game.catalogId||game.id))return {url:`steam://install/${game.catalogId||game.id}`};
  if(game.provider==='gog' && /^\d+$/.test(game.catalogId||game.id))return {url:`goggalaxy://openGameView/${game.catalogId||game.id}`};
  if(game.provider==='epic')return {url:'com.epicgames.launcher://'};
  if(game.provider==='xbox'&&/^[A-Z0-9]{12}$/i.test(game.catalogId||game.id))return {url:`msxbox://game/?productId=${String(game.catalogId||game.id).toUpperCase()}`};
  if(game.provider==='xbox')return {exe:'explorer.exe',args:['shell:AppsFolder\\Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App']};
  throw new Error('This game has no supported platform client.');
}
module.exports={readGalaxyLibrary,mergeLibraries,normalizeOwnedImport,clientPlan,artworkUrl};
