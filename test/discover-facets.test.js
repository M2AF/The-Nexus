const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DiscoverCatalog,CATEGORIES,steamBrowseRows}=require('../lib/discover');
test('Free-2-Play uses verified free metadata, not a zero promotional price or missing price',()=>{
 const rows=[1,2,3].map(id=>({provider:'steam',id:String(id),title:'Game '+id,groups:['featured']}));
 const result=steamBrowseRows({response:{store_items:[{id:1,type:0,success:1,is_free:true,assets:{asset_url_format:'steam/apps/1/${FILENAME}?t=1',main_capsule:'hash/capsule.jpg'}},{id:2,type:0,success:1,best_purchase_option:{final_price_in_cents:'0'}},{id:3,type:0,success:1}]}},rows,'CAD');
 assert(result[0].header.includes('/store_item_assets/steam/apps/1/hash/capsule.jpg'));assert.equal(result[0].freeToPlay,true);assert.equal(result[0].price,0);assert.equal(result[1].freeToPlay,false);assert.equal(result[1].price,0);assert.equal(result[2].price,null);
 assert.equal(CATEGORIES.shooters.tag,1774);
});
test('Category and section combine in source queries and remain isolated in cache',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-facets-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const urls=[];
 const catalog=new DiscoverCatalog({directory:dir,fetchImpl:async url=>{const u=new URL(url);urls.push(u);let body;
  if(u.pathname.includes('/search/results')){const ids=u.searchParams.get('maxprice')==='free'?[2,3,4,5]:[1];body={items:ids.map(id=>({name:id===4?'Adventure Demo':'Adventure '+id,logo:`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`}))};}
  else if(u.pathname.includes('/IStoreBrowseService/'))body={response:{store_items:[{id:1,type:0,success:1,tagids:[21],best_purchase_option:{final_price_in_cents:'1499'}},{id:2,type:0,success:1,tagids:[21],is_free:true},{id:3,type:0,success:1,tagids:[21],best_purchase_option:{final_price_in_cents:'0'}},{id:4,type:0,success:1,tagids:[21],is_free:true},{id:5,type:0,success:1,tagids:[21],is_free:true,release:{is_coming_soon:true}}]}};
  else if(u.hostname==='catalog.gog.com')body={products:[]};else throw Error('Other stores offline');
  return {ok:true,status:200,text:async()=>JSON.stringify(body)};
 }});
 const top=await catalog.browse({category:'adventure',section:'top'});assert.equal(top.games.length,1);assert(top.games[0].offers[0].groups.includes('top'));
 assert(urls.some(u=>u.searchParams.get('tags')==='21'&&u.searchParams.get('filter')==='topsellers'));
 assert(urls.some(u=>u.searchParams.get('genres')==='in:adventure'&&u.searchParams.get('order')==='desc:bestselling'));
 const free=await catalog.browse({category:'adventure',section:'free'});assert.equal(free.games.length,1);assert.equal(free.games[0].offers[0].id,'2');assert.equal(free.section,'free');
 assert(urls.some(u=>u.searchParams.get('tags')==='21'&&u.searchParams.get('maxprice')==='free'));
 assert.equal(Object.keys(catalog.pages).length,2);await assert.rejects(catalog.browse({section:'constructor'}));
});
