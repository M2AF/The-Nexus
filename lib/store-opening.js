'use strict';
const {storeUrl}=require('./discover');
function storeDestination(provider,id,region,slug){
 const website=storeUrl(provider,String(id),region,slug);
 const client=provider==='steam'?`steam://store/${id}`:provider==='gog'?`goggalaxy://openStoreUrl/embed.gog.com/game/${slug}`:provider==='xbox'?`msxbox://game/?productId=${id}`:provider==='epic'?`com.epicgames.launcher://store/product/${slug}`:null;
 if(provider==='battlenet'){const p=require('./battlenet').product(id);return {client:'battlenet://',clientArgs:['--game='+(p.id==='fenris'?'fen':p.id)],website};}
 return {client,website};
}
async function openStore(destination,{hasClient,openExternal,openApplication}){
 if(destination.client){let installed=false;try{installed=await hasClient(destination.client);}catch{}if(installed){try{if(destination.clientArgs){if(!openApplication)throw Error('Application handoff unavailable.');await openApplication(destination.client,destination.clientArgs);}else await openExternal(destination.client);return {success:true,opened:'client'};}catch{/* A removed or broken client registration falls back to the website. */}}}
 await openExternal(destination.website);return {success:true,opened:'website'};
}
module.exports={storeDestination,openStore};
