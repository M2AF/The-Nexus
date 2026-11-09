const test=require('node:test'),assert=require('node:assert/strict');
const {epicFeed}=require('../lib/epic-discover');
const {mergeOffers}=require('../lib/discover');
const now=Date.parse('2026-11-08T12:00:00Z');
const game={id:'offer',namespace:'namespace',title:'A real PC game',offerType:'BASE_GAME',status:'ACTIVE',effectiveDate:'2026-11-05T00:00:00Z',catalogNs:{mappings:[{pageType:'productHome',pageSlug:'a-real-pc-game'}]},keyImages:[{type:'OfferImageWide',url:'https://cdn1.epicgames.com/game.jpg'}],price:{totalPrice:{originalPrice:2999,discountPrice:0,currencyCode:'CAD',currencyInfo:{decimals:2}}},promotions:{promotionalOffers:[{promotionalOffers:[{startDate:'2026-11-05T00:00:00Z',endDate:'2026-11-12T00:00:00Z',discountSetting:{discountPercentage:0}}]}]}};
const feed=elements=>({data:{Catalog:{searchStore:{elements}}}});
test('Epic exposes real PC base games and current giveaways, excluding DLC and invalid product links',()=>{
 const rows=epicFeed(feed([game,{...game,id:'dlc',offerType:'ADD_ON'},{...game,id:'code',isCodeRedemptionOnly:true},{...game,id:'bad',catalogNs:{mappings:[{pageType:'productHome',pageSlug:'../checkout'}]}},{...game,id:'expired',expiryDate:'2026-11-01T00:00:00Z'}]),now);assert.equal(rows.length,1);assert.equal(rows[0].price,0);assert(rows[0].groups.includes('deals'));assert.equal(mergeOffers(rows)[0].offers[0].provider,'epic');
});
test('Expired and future giveaways retain their actual current price instead of being shown as free',()=>{
 for(const time of ['2026-11-04T00:00:00Z','2026-11-13T00:00:00Z'])assert.equal(epicFeed(feed([game]),Date.parse(time))[0].price,29.99);
 assert.equal(epicFeed(feed([{...game,price:undefined}]),now)[0].price,null);
 assert.throws(()=>epicFeed({errors:[{message:'blocked'}]},now));
 const expired={...epicFeed(feed([game]),now)[0],priceExpiresAt:'2000-01-01T00:00:00Z'};
 assert.equal(mergeOffers([expired])[0].offers[0].price,null);
});
