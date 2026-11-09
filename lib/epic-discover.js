'use strict';
// Epic's anonymous PC promotions feed remains public; the full catalog requires
// separate access. Never present these curated results as a complete Epic catalog.
function epicFeed(body,now=Date.now()){
 const elements=body?.data?.Catalog?.searchStore?.elements;
 if(!Array.isArray(elements))throw Error('Epic promotions are unavailable.');
 return elements.filter(p=>p.offerType==='BASE_GAME'&&p.status==='ACTIVE'&&!p.isCodeRedemptionOnly&&(!p.expiryDate||Date.parse(p.expiryDate)>now)).flatMap(p=>{
  const mapping=[...(p.offerMappings||[]),...(p.catalogNs?.mappings||[])].find(m=>m.pageType==='productHome'&&/^[a-z0-9][a-z0-9-]*$/.test(m.pageSlug||''));
  const slug=mapping?.pageSlug||p.productSlug?.replace(/\/home$/,'');
  if(!/^[a-z0-9][a-z0-9-]*$/.test(slug||'')||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.namespace||'')||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.id||''))return [];
  const price=p.price?.totalPrice,decimals=price?.currencyInfo?.decimals,unit=Number.isInteger(decimals)&&decimals>=0&&decimals<=4?10**decimals:100;
  const promotions=(p.promotions?.promotionalOffers||[]).flatMap(x=>x.promotionalOffers||[]),active=promotions.find(x=>Date.parse(x.startDate)<=now&&Date.parse(x.endDate)>now&&x.discountSetting?.discountPercentage===0);
  let amount=Number.isFinite(price?.discountPrice)&&price.discountPrice>=0?price.discountPrice/unit:null;
  // A past or future giveaway must not be shown as free now.
  if(amount===0&&price?.originalPrice>0&&!active)amount=price.originalPrice/unit;
  const release=Date.parse(p.effectiveDate),discount=Number.isFinite(amount)&&price?.originalPrice>0?Math.round(100*(1-amount*unit/price.originalPrice)):0;
  const image=type=>p.keyImages?.find(i=>i.type===type)?.url;
  return [{provider:'epic',id:p.namespace+':'+p.id,slug,title:p.title,description:p.description,header:image('OfferImageWide')||image('DieselStoreFrontWide')||image('Thumbnail'),portrait:image('OfferImageTall')||image('DieselStoreFrontTall'),genres:(p.tags||[]).map(t=>t.name).filter(Boolean),releaseDate:Number.isFinite(release)?new Date(release).toISOString():null,comingSoon:release>now,groups:['featured',...(release>now?['upcoming']:release>now-45*86400000?['new']:[]),...(discount>0?['deals']:[])],freeToPlay:price?.originalPrice===0&&amount===0,price:amount,currency:price?.currencyCode,discount,priceExpiresAt:active?.endDate}];
 });
}
module.exports={epicFeed};
