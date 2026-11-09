const test=require('node:test'),assert=require('node:assert/strict');
const {storeDestination,openStore}=require('../lib/store-opening');
test('Store actions use fixed validated product pages, never launch/install/purchase commands',()=>{
 const examples=[['steam','976730',undefined,'steam://store/976730'],['gog','1207664643','the_witcher_3_wild_hunt','goggalaxy://openStoreUrl/embed.gog.com/game/the_witcher_3_wild_hunt'],['xbox','9NTM9HXNLSZX',undefined,'msxbox://game/?productId=9NTM9HXNLSZX'],['epic','namespace:offer','fortnite','com.epicgames.launcher://store/product/fortnite']];
 for(const [provider,id,slug,expected]of examples){const plan=storeDestination(provider,id,'CA',slug);assert.equal(plan.client,expected);assert(plan.website.startsWith('https://'));}
 for(const args of [['epic','a:b','CA','../checkout'],['steam','1?action=install','CA'],['gog','1','CA','https://evil.com'],['xbox','bad','CA']])assert.throws(()=>storeDestination(...args));
});
test('Installed clients are preferred; missing, stale and failing handlers fall back once to the website',async()=>{
 const destination=storeDestination('steam','976730','CA');
 for(const scenario of ['installed','missing','lookup-error','launch-error']){const urls=[];const result=await openStore(destination,{hasClient:async()=>{if(scenario==='lookup-error')throw Error('missing handler');return scenario!=='missing';},openExternal:async url=>{urls.push(url);if(scenario==='launch-error'&&url===destination.client)throw Error('broken client');}});assert.equal(result.opened,scenario==='installed'?'client':'website');assert.deepEqual(urls,scenario==='installed'?[destination.client]:scenario==='launch-error'?[destination.client,destination.website]:[destination.website]);}
});
