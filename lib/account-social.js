'use strict';
// Account-service tokens stay in the Electron main process and encrypted storage.
const validId=(provider,id)=>typeof id==='string'&&(provider==='xbox'?/^\d{12,20}$/:/^[a-f0-9]{32}$/).test(id);
const text=value=>String(value||'').replace(/[\u0000-\u001f]/g,' ').slice(0,160);
function avatar(value){try{if(typeof value!=='string'||value.length>2048)return null;const url=new URL(value);if(url.protocol==='http:'&&url.hostname.endsWith('.xboxlive.com'))url.protocol='https:';return url.protocol==='https:'&&url.hostname.endsWith('.xboxlive.com')?url.href:null;}catch{return null;}}
class AccountSocial{
 constructor({provider,store,onChange=()=>{},fetchImpl=fetch,now=Date.now}){if(!['xbox','epic'].includes(provider))throw Error('Unsupported account platform.');Object.assign(this,{provider,store,onChange,fetch:fetchImpl,now});this.session=null;this.friends=[];this.name='';this.error='';this.lastRefresh=0;this.epoch=0;this.cooldowns=new Map();this.xboxProfiles=new Map();}
 public(){const connected=!!this.session&&this.session.expiresAt>this.now();return {provider:this.provider,connected,status:connected?'connected':this.session?'expired':'disconnected',accountId:connected?this.session.accountId:null,name:connected?this.name:'',friends:connected?this.friends:[],canMessage:false,canRemember:!!this.remembered,error:this.error,note:this.provider==='epic'?'Only friends who authorized The Nexus are available. Presence and messaging are unavailable.':'Friends and presence depend on Xbox privacy and service access. Messaging is unavailable.'};}
 notify(){this.onChange(this.public());}
 async accept(session){if(session?.provider!==this.provider||!validId(this.provider,session.accountId)||typeof session.token!=='string'||session.token.length<1||session.token.length>32768||/[\r\n]/.test(session.token)||!Number.isFinite(session.expiresAt)||session.expiresAt<=this.now()||this.provider==='xbox'&&!/^\d{1,32}$/.test(session.userHash||''))throw Error('Invalid platform session. Reconnect your account.');this.epoch++;this.cooldowns.clear();this.xboxProfiles=new Map();this.session={provider:this.provider,accountId:session.accountId,token:session.token,expiresAt:session.expiresAt,...(this.provider==='xbox'?{userHash:session.userHash}:{})};this.friends=[];if(this.provider==='xbox'&&session.profileCache?.owner===session.accountId){for(const row of (Array.isArray(session.profileCache.profiles)?session.profileCache.profiles:[]).slice(0,1000)){if(row&&validId('xbox',row.id)&&text(row.name)&&Number.isFinite(row.expires))this.xboxProfiles.set(row.id,{settings:{Gamertag:text(row.name),GameDisplayPicRaw:avatar(row.avatar)},expires:Math.min(row.expires,this.now()+600000)});}for(const [host,until] of Object.entries(session.profileCache.cooldowns||{})){if(['profile.xboxlive.com','peoplehub.xboxlive.com','social.xboxlive.com','userpresence.xboxlive.com'].includes(host)&&Number.isFinite(until)&&until>this.now())this.cooldowns.set(host,until);}}this.name=text(session.name)||(this.provider==='xbox'?'Xbox player':'Epic player');this.error='';this.lastRefresh=0;this.remembered=this.store.set(this.provider,this.session);await this.refresh(true);return this.public();}
 restore(){const saved=this.store.get(this.provider);if(saved)this.accept(saved).catch(()=>{this.store.set(this.provider,null);});return this.public();}
 disconnect(){this.epoch++;this.cooldowns.clear();this.xboxProfiles=new Map();this.session=null;this.friends=[];this.name='';this.error='';this.remembered=false;this.store.set(this.provider,null);this.notify();return this.public();}
 async json(url,{body,version,session=this.session}={}){
  if(!session||session!==this.session)throw Error('Your platform session changed. Refresh your account.');
  if(session.expiresAt<=this.now())throw Error('Your platform session expired. Reconnect in Accounts.');
  const host=new URL(url).hostname;
  if((this.cooldowns.get(host)||0)>this.now()){const error=Error((this.provider==='xbox'?'Xbox':'Epic')+' requests are rate limited. Retrying automatically after the cooldown.');error.status=429;throw error;}
  const auth=this.provider==='xbox'?'XBL3.0 x='+session.userHash+';'+session.token:'Bearer '+session.token;let response;
  try{response=await this.fetch(url,{method:body?'POST':'GET',headers:{Authorization:auth,Accept:'application/json',...(version?{'x-xbl-contract-version':version}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw Error('Could not reach '+this.provider+'. Try refreshing.');}
  if(session!==this.session)throw Error('Your platform session changed. Refresh your account.');
  if(response.status===429){const retry=response.headers?.get?.('retry-after'),seconds=Number(retry),date=Date.parse(retry||''),delay=retry&&Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-this.now():300000;this.cooldowns.set(host,this.now()+Math.max(15000,Math.min(900000,delay)));const error=Error((this.provider==='xbox'?'Xbox':'Epic')+' requests are rate limited. Retrying automatically after the cooldown.');error.status=429;throw error;}
  if(!response.ok){const error=Error(response.status===401?'Your platform session expired. Reconnect in Accounts.':response.status===403?'This application cannot access these platform friends. Check platform permissions and privacy.':'Platform friends are temporarily unavailable.');error.status=response.status;throw error;}
  if(response.headers?.get?.('x-xbl-servicedefault'))throw Error('Xbox profile details are temporarily unavailable.');return response.json();
 }
 async epic(){const session=this.session,owner=session.accountId,source=await this.json('https://api.epicgames.dev/epic/friends/v1/'+owner,{session});if(!Array.isArray(source.friends))throw Error('Invalid Epic friends response.');const blocked=new Set((source.blockList||[]).map(row=>row.accountId)),ids=[...new Set(source.friends.map(row=>row.accountId).filter(id=>validId('epic',id)&&!blocked.has(id)))].slice(0,1000),profiles=new Map();for(let i=0;i<ids.length+1;i+=50){const batch=i===0?[owner,...ids.slice(0,49)]:ids.slice(i-1,i+49);if(!batch.length)continue;const query=new URLSearchParams();for(const id of batch)query.append('accountId',id);const rows=await this.json('https://api.epicgames.dev/epic/id/v2/accounts?'+query,{session});if(!Array.isArray(rows))throw Error('Invalid Epic profiles response.');for(const row of rows)if(batch.includes(row.accountId))profiles.set(row.accountId,row);}return {name:text(profiles.get(owner)?.displayName)||'Epic player',friends:ids.map(id=>({provider:'epic',id,name:text(profiles.get(id)?.displayName)||'Epic player',avatar:null,online:null,playing:null,canMessage:false}))};}
 saveXboxCache(session){
  if(session!==this.session)return;
  let bytes=0;const profiles=[];
  for(const [id,row] of this.xboxProfiles){const name=text(row.settings.Gamertag);if(!name)continue;const item={id,name,avatar:avatar(row.settings.GameDisplayPicRaw),expires:row.expires};bytes+=Buffer.byteLength(JSON.stringify(item));if(bytes>600000||profiles.length>=1000)break;profiles.push(item);}
  session.name=this.name;session.profileCache={owner:session.accountId,profiles,cooldowns:Object.fromEntries(this.cooldowns)};this.remembered=this.store.set(this.provider,session);
 }
 async xbox(){
  const session=this.session;
  try{
   // Microsoft's Social Manager uses this graph endpoint (contract 7) for
   // gamertags, pictures and presence together. Avoid per-friend profile calls.
   const data=await this.json('https://peoplehub.xboxlive.com/users/xuid('+session.accountId+')/people/friends/decoration/presenceDetail',{session,version:'7'});
   if(!Array.isArray(data.people))throw Error('Invalid Xbox friends response.');
   if(session!==this.session)throw Error('Your platform session changed.');
   const seen=new Set(),friends=[];
   for(const row of data.people.slice(0,1000)){
    if(!validId('xbox',row.xuid)||seen.has(row.xuid)||row.isFriend===false)continue;seen.add(row.xuid);
    const previous=this.xboxProfiles.get(row.xuid)?.settings,name=text(row.uniqueModernGamertag||row.gamertag||row.modernGamertag||row.displayName)||text(previous?.Gamertag),picture=avatar(row.displayPicRaw)||avatar(previous?.GameDisplayPicRaw);
    if(name)this.xboxProfiles.set(row.xuid,{settings:{Gamertag:name,GameDisplayPicRaw:picture},expires:this.now()+600000});
    const state=String(row.presenceState||'').toLowerCase(),online=state==='online'?true:state==='offline'?false:null,detail=online?(Array.isArray(row.presenceDetails)?row.presenceDetails:[]).find(item=>String(item.State).toLowerCase()==='active'&&item.IsGame===true&&item.PresenceText):null;
    friends.push({provider:'xbox',id:row.xuid,name:name||'Xbox friend · '+row.xuid.slice(-4),avatar:picture,online,playing:detail?text(detail.PresenceText).split(' - ')[0]:null,canMessage:false});
   }
   let name=this.name;
   if(!name||name==='Xbox player'){try{const owner=await this.json('https://profile.xboxlive.com/users/batch/profile/settings',{session,version:'2',body:{userIds:[session.accountId],settings:['Gamertag','GameDisplayPicRaw']}});name=text(owner.profileUsers?.find(row=>row.id===session.accountId)?.settings?.find(setting=>setting.id==='Gamertag')?.value)||name;}catch{}}
   return {name:name||'Xbox player',friends,error:''};
  }catch(error){
   // Preserve the existing compatibility path if this account cannot use PeopleHub.
   if(error.status===429&&this.friends.length)return {name:this.name,friends:this.friends,error:error.message};
   return this.xboxLegacy();
  }
 }
 async xboxLegacy(){
  const session=this.session,owner=session.accountId,profiles=this.xboxProfiles,presence=new Map(),warnings=[];
  const readProfiles=async ids=>{
   const needed=ids.filter(id=>(profiles.get(id)?.expires||0)<=this.now());
   for(let offset=0;offset<needed.length;offset+=100){const batch=needed.slice(offset,offset+100);
    try{const data=await this.json('https://profile.xboxlive.com/users/batch/profile/settings',{session,version:'2',body:{userIds:batch,settings:['Gamertag','GameDisplayPicRaw']}});
     if(session!==this.session)throw Error('Your platform session changed.');
     for(const row of data.profileUsers||[])if(batch.includes(row.id))profiles.set(row.id,{settings:Object.fromEntries((row.settings||[]).map(setting=>[setting.id,setting.value])),expires:this.now()+600000});
    }catch(error){warnings.push(error.message);break;}
   }
  };
  // Load the owner separately so an unavailable friend batch cannot hide the gamertag.
  if(!this.name||this.name==='Xbox player')await readProfiles([owner]);
  const name=text(profiles.get(owner)?.settings.Gamertag)||this.name||'Xbox player';
  if(session===this.session&&name!=='Xbox player'&&session.name!==name){session.name=name;this.store.set(this.provider,session);}
  const ids=[];
  try{for(let start=0;start<1000;start+=100){const data=await this.json('https://social.xboxlive.com/users/me/people?view=All&startIndex='+start+'&maxItems=100',{session,version:'1'});if(!Array.isArray(data.people))throw Error('Invalid Xbox friends response.');ids.push(...data.people.map(row=>row.xuid).filter(id=>validId('xbox',id)));if(data.people.length<100||start+data.people.length>=data.totalCount)break;}}
  catch(error){return {name,friends:this.friends,error:error.message};}
  const unique=[...new Set(ids)].slice(0,1000);
  await readProfiles(unique);
  if(unique.length){try{const rows=await this.json('https://userpresence.xboxlive.com/users/batch',{session,version:'3',body:{users:unique,level:'title'}});if(!Array.isArray(rows))throw Error('Invalid Xbox presence response.');for(const row of rows)if(unique.includes(row.xuid))presence.set(row.xuid,row);}catch{warnings.push('Some Xbox presence is unavailable.');}}
  return {name,error:[...new Set(warnings)].join(' '),friends:unique.map(id=>{const profile=profiles.get(id)?.settings,status=presence.get(id),online=status?status.state==='Online'||status.state==='online'?true:status.state==='Offline'||status.state==='offline'?false:null:null,title=online?(status.devices||[]).flatMap(device=>device.titles||[]).find(title=>title.state==='active'&&title.name):null;return {provider:'xbox',id,name:text(profile?.Gamertag)||'Xbox friend · '+id.slice(-4),avatar:avatar(profile?.GameDisplayPicRaw),online,playing:title?text(title.name):null,canMessage:false};})};
 }
 async refresh(force=false){if(this.loading)return this.loading;if(!this.session||!force&&this.now()-this.lastRefresh<60000)return this.public();const epoch=this.epoch;this.lastRefresh=this.now();this.loading=(async()=>{try{const data=await this[this.provider]();if(epoch===this.epoch){this.name=data.name;this.friends=data.friends;this.error=data.error||'';if(this.provider==='xbox')this.saveXboxCache(this.session);}}catch(e){if(epoch===this.epoch)this.error=e.message;}finally{if(epoch===this.epoch)this.notify();}})().finally(()=>{this.loading=null;});await this.loading;return this.public();}
 close(){this.epoch++;}
}
module.exports={AccountSocial};
