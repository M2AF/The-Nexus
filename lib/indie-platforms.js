const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {artworkUrl}=require('./catalog');
function readItchLibrary(databasePath,accountId){
  if(!fs.existsSync(databasePath))return {available:false,installed:[],owned:[],message:'itch.io app cache not found. Open itch.io and sync its library, then scan again.'};
  const database=new DatabaseSync(databasePath,{readOnly:true});
  try{
    database.exec('PRAGMA busy_timeout=2000');
    const installed=[];
    const rows=database.prepare(`SELECT c.id caveId,c.game_id gameId,c.installed_size,c.install_folder_name,c.custom_install_folder,c.installed_at,l.path root,g.title,g.cover_url,g.still_cover_url,g.classification FROM caves c JOIN games g ON g.id=c.game_id LEFT JOIN install_locations l ON l.id=c.install_location_id`).all();
    for(const row of rows){
      if(row.classification && row.classification!=='game')continue;
      const folder=row.custom_install_folder || (row.root && row.install_folder_name ? path.resolve(row.root,row.install_folder_name):'');
      if(!folder || !path.isAbsolute(folder)||!row.installed_at||!fs.existsSync(folder)||!fs.statSync(folder).isDirectory())continue;
      const cover=artworkUrl(row.still_cover_url||row.cover_url);
      installed.push({provider:'itch',providerLabel:'itch.io',id:String(row.gameId),name:row.title,installLocation:folder,sizeGb:row.installed_size>0?(row.installed_size/1e9).toFixed(1):null,portrait:cover,header:cover,launchTarget:{gameId:String(row.gameId)},launchType:'itch',caveId:row.caveId});
    }
    // Only select non-secret identifiers. Never select profiles.api_key or profile_data.
    const accounts=database.prepare('SELECT CAST(id AS TEXT) id,CAST(user_id AS TEXT) userId FROM profiles').all();
    const account=accounts.length===1?accounts[0]:accounts.find(account=>account.id===accountId);
    if(!account)return {available:true,installed,owned:[],accounts,needsAccount:accounts.length>1,message:accounts.length?'Choose a cached itch.io account.':'Sign in and sync the itch.io app to populate owned games.'};
    const ownedRows=database.prepare(`SELECT DISTINCT g.id,g.title,g.cover_url,g.still_cover_url,g.classification FROM games g WHERE g.id IN (SELECT game_id FROM download_keys WHERE owner_id=? UNION SELECT bg.game_id FROM bundle_games bg JOIN bundle_keys bk ON bk.bundle_id=bg.bundle_id WHERE bk.owner_id=?)`).all(account.userId,account.userId);
    const owned=ownedRows.filter(row=>!row.classification||row.classification==='game').map(row=>({provider:'itch',providerLabel:'itch.io',id:String(row.id),name:row.title,owned:true,ownershipSource:'itch.io local library',portrait:artworkUrl(row.still_cover_url||row.cover_url),header:artworkUrl(row.still_cover_url||row.cover_url)}));
    return {available:true,installed,owned,accounts,accountId:account.id,installedCount:installed.length,ownedCount:owned.length,importedAt:new Date().toISOString(),message:'Cached purchase/download-key and owned-bundle records. Only games already indexed by the itch.io app can be imported.'};
  }finally{database.close();}
}
function decode(text){return String(text||'').replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[0-9a-f]+|\d+);/gi,value=>{
  const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};if(named[value.toLowerCase()])return named[value.toLowerCase()];const code=value.toLowerCase().startsWith('&#x')?parseInt(value.slice(3,-1),16):parseInt(value.slice(2,-1),10);return code>=0&&code<=0x10ffff?String.fromCodePoint(code):'';
});}
function attr(text,name){return decode(String(text).match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(["\x27])([\\s\\S]*?)\\1','i'))?.[2]);}
function wavedashUrl(value){
  if(String(value).length>2048)throw new Error('Wavedash link is too long.');
  const url=new URL(value,'https://wavedash.com');
  url.pathname=url.pathname.toLowerCase();
  if(url.protocol!=='https:'||!['wavedash.com','www.wavedash.com'].includes(url.hostname)||url.username||url.password||url.port||!/^\/games\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(url.pathname))throw new Error('Use a Wavedash game link such as https://wavedash.com/games/botany-manor.');
  return `https://wavedash.com${url.pathname.replace(/\/$/,'')}`;
}
function webGame(url,name,cover){const canonical=wavedashUrl(url),id=canonical.split('/').pop();return {provider:'wavedash',providerLabel:'Wavedash',id,name:decode(name)||id.replace(/-/g,' '),web:true,installed:false,owned:false,ownershipSource:'Wavedash public catalog',portrait:artworkUrl(cover),header:artworkUrl(cover),webUrl:canonical};}
function parseWavedashCatalog(html){
  const games=new Map();
  for(const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=attr(match[1],'href');if(!/^\/games\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href))continue;
    const image=match[2].match(/<img\b[^>]*>/i)?.[0];if(!image)continue;
    const name=attr(image,'alt')||attr(match[1],'title');if(!name)continue;
    const game=webGame(href,name,attr(image,'src'));if(!games.has(game.id))games.set(game.id,game);
  }
  return [...games.values()];
}
async function publicHtml(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!response.ok)throw new Error(`Wavedash returned ${response.status}.`);
  const reader=response.body.getReader();let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4e6){await reader.cancel();throw new Error('Wavedash page is larger than expected.');}chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks).toString('utf8');
}
async function readWavedashCatalog(){
  const games=parseWavedashCatalog(await publicHtml('https://wavedash.com/'));
  if(!games.length)throw new Error('Wavedash catalog could not be read. Saved links remain available; add a game link manually.');
  return {available:true,games,importedAt:new Date().toISOString(),source:'Wavedash public home page',message:'Public browser-game catalog, not account ownership. Some games or paid content may require a Wavedash sign-in or purchase.'};
}
async function readWavedashGame(value){
  const url=wavedashUrl(value),html=await publicHtml(url);
  const metas=[...html.matchAll(/<meta\b[^>]*>/gi)].map(match=>({property:attr(match[0],'property'),content:attr(match[0],'content')}));
  const heading=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]*>/g,'').trim();
  const title=heading || metas.find(meta=>meta.property==='og:title')?.content.replace(/^Play\s+/i,'').replace(/\s+(?:for free\s+)?on Wavedash.*$/i,'').replace(/\s*[|–-]\s*Wavedash.*$/i,'');
  const cover=metas.find(meta=>meta.property==='og:image')?.content;
  return {...webGame(url,title,cover),ownershipSource:'Saved Wavedash link'};
}
module.exports={readItchLibrary,parseWavedashCatalog,readWavedashCatalog,readWavedashGame,wavedashUrl};
