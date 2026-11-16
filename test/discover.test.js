const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DiscoverCatalog,mergeOffers,steamFeed,gogFeed,xboxFeed,xboxProducts,storeUrl,imageUrl,identity}=require('../lib/discover');
const base={title:'Halo: The Master Chief Collection',groups:['new'],price:null};
test('Epic is added once to legacy preferences while deliberate store exclusions remain saved',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-epic-prefs-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'discover-preferences.json'),JSON.stringify({region:'CA',stores:['steam','gog','xbox']}));
 const migrated=new DiscoverCatalog({directory:dir});assert(migrated.preferences.stores.includes('epic'));
 migrated.setPreferences({region:'CA',stores:['steam']});assert.deepEqual(new DiscoverCatalog({directory:dir}).preferences.stores,['steam']);
});
test('Discover merges exact titles across stores, preserves editions and separates ambiguous same-name listings',()=>{
 const steam={...base,provider:'steam',id:'976730'},xbox={...base,provider:'xbox',id:'9NTM9HXNLSZX'};
 const result=mergeOffers([steam,{...steam,groups:['top']},xbox,{...steam,id:'22',title:base.title+' Deluxe Edition'}]);assert.equal(result.length,2);assert.equal(result[0].offers.length,2);assert(result[0].groups.includes('top'));
 assert.equal(mergeOffers([{...steam,title:'Prey',id:'11'},{...steam,title:'Prey',id:'12'},{...xbox,title:'Prey'}]).length,3);
 assert.equal(identity('Halo®: Reach'),identity('Halo Reach'));assert.notEqual(identity('Halo 2'),identity('Halo 3'));
});
test('Different platform arrival dates share one listing and do not hide additional matching stores',async t=>{
 const gog={provider:'gog',id:'2093619782',slug:'cyberpunk_2077',title:'Cyberpunk 2077',releaseDate:'2020-12-10',groups:['top']};
 const xbox={provider:'xbox',id:'BX3M8L83BBRW',title:'Cyberpunk 2077',releaseDate:'2026-10-22',groups:['new']};
 const steam={provider:'steam',id:'1091500',title:'Cyberpunk 2077™',groups:['featured']};
 const merged=mergeOffers([gog,xbox]);assert.equal(merged.length,1);assert.deepEqual(merged[0].offers.map(o=>o.provider),['gog','xbox']);assert(merged[0].groups.includes('new'));assert(merged[0].groups.includes('top'));
 assert.equal(mergeOffers([gog,xbox,steam]).length,1);
 assert.equal(mergeOffers([gog,xbox,{...gog,id:'1274966284',slug:'cyberpunk_2077_ultimate_edition',title:'Cyberpunk 2077: Ultimate Edition'}]).length,2);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-store-dates-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 // Existing catalog caches must regroup without requiring a rescan or deleting preferences.
 fs.writeFileSync(path.join(dir,'discover-cache.json'),JSON.stringify({version:1,pages:{'CA::':{region:'CA',query:'',category:'',rows:[gog,xbox],statuses:{},updatedAt:Date.now()}}}));
 const catalog=new DiscoverCatalog({directory:dir});const page=catalog.present(Object.values(catalog.pages)[0],true);assert.equal(page.games.length,1);
 catalog.browse=async()=>({games:mergeOffers([gog,xbox,steam]),statuses:{steam:{ok:true},gog:{ok:true},xbox:{ok:true}}});
 catalog.enrich=async game=>game;
 const details=await catalog.details(page.games[0].key,'CA');assert.equal(details.game.offers.length,3);assert(catalog.open(details.game.key,'steam','CA').includes('/1091500/'));
});
test('Store links are reconstructed from validated IDs and artwork rejects foreign/local/credential URLs',()=>{
 assert(storeUrl('steam','976730','CA').includes('cc=ca'));assert(storeUrl('xbox','9NTM9HXNLSZX','CA').includes('/en-CA/'));
 for(const args of [['steam','1?evil=1'],['xbox','not-an-id'],['gog','123','CA','../checkout'],['steam','1','XX']])assert.throws(()=>storeUrl(...args));
 for(const url of ['file:///C:/secret','http://images.gog.com/x','https://images.gog.com.evil.example/a','https://user:pass@images.gog.com/a'])assert.equal(imageUrl(url),null);assert(imageUrl('https://store-images.s-microsoft.com/image/game'));
});
test('Catalog parsers omit non-Windows games, console offers and unknown free prices',()=>{
 const rows=steamFeed({coming_soon:{items:[{id:1,type:0,name:'Future',windows_available:true,original_price:null,final_price:0,currency:'CAD'}]},top_sellers:{items:[{id:2,type:0,name:'Mac',windows_available:false}]}});assert.equal(rows.length,1);assert.equal(rows[0].price,null);
 assert.equal(gogFeed({products:[{productType:'game',operatingSystems:['osx'],id:1}]}).length,0);
 assert.equal(gogFeed({products:[{id:'123',slug:'complete_edition',title:'Complete Edition',productType:'pack',operatingSystems:['windows']}]}).length,1);
 const xbox={core2:{products:{productSummaries:{a:{title:'Console',productId:'AAAAAAAAAAAA',productKind:'Game',availableOn:['XboxSeriesX']},b:{title:'PC',productId:'BBBBBBBBBBBB',productKind:'Game',availableOn:['PC'],specificPrices:{purchaseable:[]}}}}}};assert.equal(xboxFeed('window.__PRELOADED_STATE__ = '+JSON.stringify(xbox)+';')[0].title,'PC');
 const product=id=>({ProductKind:'Game',ProductId:id,LocalizedProperties:[{ProductTitle:'Halo'}],DisplaySkuAvailabilities:[{Sku:{Properties:{}},Availabilities:[{Actions:['Details'],Conditions:{ClientConditions:{AllowedPlatforms:[{PlatformName:'Windows.Desktop'}]}}}]}]});const p=product('AAAAAAAAAAAA');assert.equal(xboxProducts({Products:[p]}).length,0);p.DisplaySkuAvailabilities[0].Availabilities[0].Actions.push('Purchase');assert.equal(xboxProducts({Products:[p]}).length,1);
});
test('Catalog cache isolates regions, coalesces refreshes, retains failed-store results and persists preferences',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-discover-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let clock=Date.now(),failed=false,calls=0;
 const c=new DiscoverCatalog({directory:dir,now:()=>clock,fetchImpl:async url=>{calls++;if(failed)throw Error('offline');const body=url.includes('featuredcategories')?{new_releases:{items:[{id:976730,type:0,name:base.title,windows_available:true,original_price:4999,final_price:4999,currency:'CAD'}]}}:url.includes('gog.com')?{products:[]}:{core2:{products:{productSummaries:{}}}};return {ok:true,status:200,text:async()=>url.includes('xbox.com')?'window.__PRELOADED_STATE__ = '+JSON.stringify(body)+';':JSON.stringify(body)};}});
 const [a,b]=await Promise.all([c.browse(),c.browse()]);assert.equal(a.games[0].name,base.title);const before=calls;await c.browse();assert.equal(calls,before);assert.equal(a.games[0].key,b.games[0].key);clock+=7*3600000;failed=true;const stale=await c.browse();assert.equal(stale.games.length,1);assert.equal(stale.statuses.steam.ok,false);assert.equal(c.open(stale.games[0].key,'steam','CA'),storeUrl('steam','976730','CA'));assert.throws(()=>c.open(stale.games[0].key,'xbox','CA'));
 c.setPreferences({region:'GB',stores:['gog']});const restored=new DiscoverCatalog({directory:dir,fetchImpl:async()=>{throw Error('offline')}});assert.deepEqual(restored.preferences,{region:'GB',stores:['gog']});assert.equal((await restored.browse({region:'US'})).games.length,0);await assert.rejects(c.browse({category:'arbitrary'}));
});
test('Genre categories use GOG source slugs and keep matching results even without theme-word aliases',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-category-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let requested;
 const c=new DiscoverCatalog({directory:dir,fetchImpl:async url=>{if(url.includes('catalog.gog.com')){requested=new URL(url);return {ok:true,status:200,text:async()=>JSON.stringify({products:[{id:'123',slug:'fixture_rpg',title:'Fixture RPG',productType:'game',operatingSystems:['windows'],genres:[{name:'Role-playing'}]}]})};}throw Error('Other stores offline');}});
 const result=await c.browse({category:'rpg'});assert.equal(requested.searchParams.get('genres'),'in:rpg');assert.equal(result.games.length,1);assert.equal(result.games[0].offers[0].provider,'gog');assert.equal(result.statuses.gog.count,1);
 await assert.rejects(c.browse({region:'constructor'}));assert.throws(()=>c.setPreferences({region:'CA',stores:['constructor']}));
});
test('Discover keeps only trusted trailer streams and YouTube IDs, and picks matching YouTube trailers',()=>{
 const {videoList,youtubeTrailers,videoUrl}=require('../lib/discover');
 assert.equal(videoUrl('https://video.akamai.steamstatic.com/store_trailers/1/2/hls_264_master.m3u8?t=1'),'https://video.akamai.steamstatic.com/store_trailers/1/2/hls_264_master.m3u8?t=1');
 assert.equal(videoUrl('https://evil.example/hls.m3u8'),null);assert.equal(videoUrl('http://video.akamai.steamstatic.com/a.m3u8'),null);assert.equal(videoUrl('https://video.akamai.steamstatic.com/a.mp4'),null);
 const list=videoList([{kind:'hls',src:'https://video.akamai.steamstatic.com/a/hls_264_master.m3u8',title:'<b>Launch</b>',poster:'https://evil.example/x.jpg'},{kind:'youtube',id:'PZ_gex3U31U'},{kind:'youtube',id:'bad id'},{kind:'iframe',src:'https://x'}]);
 assert.equal(list.length,2);assert.equal(list[0].title,'Launch');assert.equal(list[0].poster,null);assert.equal(list[1].poster,'https://i.ytimg.com/vi/PZ_gex3U31U/hqdefault.jpg');
 const html=['BODY CAM | Official Trailer | Paramount Movies','Bodycam - Official Launch Trailer','Bodycam - Zombie Update Teaser Trailer','Bodycam - Official Third Trailer'].map((title,i)=>`"videoRenderer":{"videoId":"vid${i}aaaaaaa","thumbnail":{},"title":{"runs":[{"text":"${title}"}]}`).join(',');
 assert.deepEqual(youtubeTrailers(html,'Bodycam').map(v=>v.id),['vid1aaaaaaa','vid2aaaaaaa']);
 assert.deepEqual(youtubeTrailers(html,'Halo'),[]);
});
test('Discover media prefers reachable Steam trailers and falls back to YouTube when stores have none',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-media-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const hls='https://video.akamai.steamstatic.com/store_trailers/1/2/hls_264_master.m3u8';let steamManifest=true;
 const reply=(body,json=true)=>({status:200,ok:true,headers:{get:()=>null},text:async()=>json?JSON.stringify(body):body});
 const fetchImpl=async url=>{
  if(url.includes('appdetails'))return reply({'976730':{data:{type:'game',name:'Halo: The Master Chief Collection',platforms:{windows:true},movies:[{name:'Launch',hls_h264:hls,thumbnail:'https://shared.akamai.steamstatic.com/a.jpg'}]}}});
  if(url.startsWith(hls)){if(!steamManifest)return {status:403,ok:false,headers:{get:()=>null},text:async()=>''};return reply('#EXTM3U\n',false);}
  if(url.startsWith('https://www.youtube.com/results'))return reply('"videoRenderer":{"videoId":"PZ_gex3U31U","title":{"runs":[{"text":"Halo: The Master Chief Collection - Launch Trailer"}]}',false);
  throw Error('unexpected '+url);
 };
 const catalog=new DiscoverCatalog({directory:dir,fetchImpl});const [game]=mergeOffers([{...base,provider:'steam',id:'976730'}]);catalog.index.set('CA:'+game.key,game);
 const media=await catalog.media(game.key,'CA');assert.equal(media.source,'steam');assert.equal(media.videos[0].src,hls);
 catalog.mediaCache.clear();catalog.previews.clear();steamManifest=false;
 const fallback=await catalog.media(game.key,'CA');assert.equal(fallback.source,'youtube');assert.equal(fallback.videos[0].id,'PZ_gex3U31U');
});
