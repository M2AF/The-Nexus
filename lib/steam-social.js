'use strict';

const {XMLParser}=require('fast-xml-parser');

function steamId(value){const id=String(value||'');if(!/^7656119\d{10}$/.test(id))throw Error('Invalid Steam account.');return id;}

function steamAppId(user){const id=String(user.game_played_app_id||'');return /^[1-9]\d{0,9}$/.test(id)&&Number(id)<=4294967295?id:null;}

function avatar(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname.endsWith('.steamstatic.com')||['steamcdn-a.akamaihd.net','steamcommunity-a.akamaihd.net'].includes(u.hostname))?u.href:null;}catch{return null;}}

function parseAchievements(xml){if(typeof xml!=='string'||xml.length>2e6||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Invalid achievement response.');const data=new XMLParser({ignoreAttributes:false,processEntities:false,parseTagValue:false,trimValues:true}).parse(xml)?.playerstats;if(!data||data.error)throw Error('Steam does not expose achievement data for this game/profile.');let rows=data.achievements?.achievement||[];if(!Array.isArray(rows))rows=[rows];return rows.slice(0,5000).map((row,i)=>({id:String(row.apiname||i),name:String(row.name||row.apiname||'Achievement').slice(0,200),description:String(row.description||'').slice(0,1000),unlocked:String(row['@_closed'])==='1',icon:avatar(row.iconClosed),unlockedAt:row.unlockTimestamp?Number(row.unlockTimestamp)*1000:null}));}

class SteamSocial{

 constructor({store,onChange=()=>{},onLibrary=()=>{},onAccount=()=>{},client,sessionFactory,qr,fetcher=fetch,local}){

  this.gameNames=new Map();this.gameLookups=new Map();this.local=local;this.store=store;this.onChange=onChange;this.onLibrary=onLibrary;this.onAccount=onAccount;this.fetch=fetcher;this.status='disconnected';this.error=null;this.generation=0;this.cookies=null;this.qrImage=null;

  this.client=client||new (require('steam-user'))({dataDirectory:null,autoRelogin:true,enablePicsCache:false});this.sessionFactory=sessionFactory||(()=>{const {LoginSession,EAuthTokenPlatformType}=require('steam-session');return new LoginSession(EAuthTokenPlatformType.SteamClient,{userAgent:'The Nexus game launcher'});});this.qr=qr||(value=>require('qrcode').toDataURL(value,{width:240,margin:2}));

  this.client.on('loggedOn',()=>{this.status='connected';this.qrImage=null;this.error=null;this.client.setUIMode?.(4);this.client.setPersona(7);if(this.client.steamID)this.onAccount(this.client.steamID.toString());this.notify();this.syncLibrary().catch(()=>{});});

  this.client.on('refreshToken',token=>{if(this.status!=='disconnected'&&typeof token==='string')this.store.set('steam',{refreshToken:token});});

  this.client.on('webSession',(_id,cookies)=>{this.cookies=cookies.join('; ');});

  this.client.on('friendsList',()=>{const ids=Object.entries(this.client.myFriends||{}).filter(([,relationship])=>relationship===3).map(([id])=>id);if(ids.length)this.client.getPersonas(ids.slice(0,2000),()=>this.notify());this.notify();});

  this.client.on('user',()=>this.notify());

  this.client.on('error',()=>{this.status='error';this.error='Steam connection failed. Reconnect and approve the login in Steam Guard.';this.qrImage=null;this.notify();});

  this.client.on('disconnected',()=>{if(this.status==='connected')this.status='offline';this.cookies=null;this.notify();});

  this.client.chat.on('friendMessage',()=>this.notify());this.client.chat.on('friendMessageEcho',()=>this.notify());

 }

 notify(){this.resolveGameNames();if(this.notifyTimer)return;this.notifyTimer=setTimeout(()=>{this.notifyTimer=null;this.onChange(this.public());},150);this.notifyTimer.unref();}

 resolveGameNames(){

  if(this.status!=='connected'||typeof this.client.getProductInfo!=='function')return;

  const ids=[...new Set(Object.entries(this.client.myFriends||{}).filter(([,r])=>r===3).map(([id])=>steamAppId(this.client.users?.[id]||{})).filter(id=>id&&!this.gameNames.has(id)&&(this.gameLookups.get(id)||0)<Date.now()))].slice(0,100);

  if(!ids.length)return;for(const id of ids)this.gameLookups.set(id,Date.now()+300000);

  const generation=this.generation;this.client.getProductInfo(ids.map(Number),[],false,(error,apps)=>{if(error||generation!==this.generation||this.status!=='connected')return;let changed=false;for(const id of ids){const name=apps?.[id]?.appinfo?.common?.name;if(typeof name==='string'&&name.trim()){this.gameNames.set(id,name.slice(0,240));changed=true;}}if(changed)this.notify();});

 }

 public(){if(this.status!=='connected')return {provider:'steam',mode:'account',canMessage:false,note:'Sign in with Steam Guard to use Steam chat inside Nexus. This uses a separate Steam chat session.',status:this.status,connected:false,accountId:null,name:null,avatar:null,friends:[],qrImage:this.qrImage,error:this.error,remembered:!!this.store.get('steam')?.refreshToken,canRemember:this.store.available};const users=this.client.users||{},friends=Object.entries(this.client.myFriends||{}).filter(([,relationship])=>relationship===3).map(([id])=>{const user=users[id]||{};return {id,provider:'steam',name:user.player_name||'Steam friend',canMessage:true,externalChat:false,chatNote:'Steam messages and replies are handled inside Nexus through your Steam sign-in.',avatar:avatar(user.avatar_url_medium),online:typeof user.persona_state==='number'?user.persona_state!==0:null,gameId:steamAppId(user),playing:typeof user.persona_state==='number'&&user.persona_state===0?null:user.game_name||this.gameNames.get(steamAppId(user))||(steamAppId(user)?'Steam game · '+steamAppId(user):null)};}).sort((a,b)=>Number(!!b.online)-Number(!!a.online)||a.name.localeCompare(b.name));const self=this.client.steamID?users[this.client.steamID.toString()]||{}:{};return {provider:'steam',mode:'account',canMessage:true,note:'Steam chat is handled inside Nexus through your separate Steam sign-in.',status:this.status,connected:this.status==='connected',accountId:this.client.steamID?.toString()||null,name:self.player_name||null,avatar:avatar(self.avatar_url_medium),friends,qrImage:this.qrImage,error:this.error,remembered:!!this.store.get('steam')?.refreshToken,canRemember:this.store.available};}

 refresh(){return this.public();}
 restore(){const token=this.store.get('steam')?.refreshToken;if(token){this.status='connecting';this.client.logOn({refreshToken:token,logonID:0x4e455855});}}

 async connect(){const epoch=++this.generation;this.pending?.cancelLoginAttempt();this.qrImage=null;this.error=null;this.status='connecting';const session=this.sessionFactory();this.pending=session;

  session.on('authenticated',()=>{if(epoch!==this.generation)return;this.pending=null;this.qrImage=null;this.store.set('steam',{refreshToken:session.refreshToken});try{this.client.logOn({refreshToken:session.refreshToken,logonID:0x4e455855});this.notify();}catch{failed();}});

  const failed=()=>{if(epoch!==this.generation)return;this.status='error';this.qrImage=null;this.error='Steam login expired or failed. Generate a new QR code and try again.';this.notify();};session.on('timeout',failed);session.on('error',failed);

  try{const result=await session.startWithQR();if(epoch!==this.generation)return this.public();if(!/^https:\/\/s\.team\/q\//.test(result.qrChallengeUrl))throw Error('Invalid Steam login response.');const image=await this.qr(result.qrChallengeUrl);if(epoch!==this.generation)return this.public();this.qrImage=image;this.status='awaiting-approval';this.notify();return this.public();}catch{failed();throw Error('Steam sign-in is unavailable. Try again.');}

 }

 disconnect(){this.generation++;this.pending?.cancelLoginAttempt();this.pending=null;this.client.logOff();this.status='disconnected';this.qrImage=null;this.cookies=null;this.error=null;this.store.set('steam',null);this.notify();return this.public();}

 friend(id){id=steamId(id);if(this.status!=='connected')throw Error('Connect Steam first.');if(this.client.myFriends?.[id]!==3)throw Error('Choose a current Steam friend.');return id;}

 async messages(id){id=this.friend(id);const epoch=this.generation,owner=this.client.steamID?.toString();const data=await this.client.chat.getFriendMessageHistory(id,{maxCount:50,wantBbcode:false});this.friend(id);if(epoch!==this.generation||owner!==this.client.steamID?.toString())throw Error('Steam account changed. Reopen the conversation.');return {messages:(data.messages||[]).slice(0,50).reverse().map(message=>({sender:String(message.sender),text:String(message.message||'').slice(0,10000),at:new Date(message.server_timestamp).getTime()}))};}

 async send(id,text){id=this.friend(id);if(typeof text!=='string'||!text.trim()||text.length>2000||text.includes('\0'))throw Error('Write a message up to 2,000 characters.');await this.client.chat.sendFriendMessage(id,text,{containsBbCode:false});return {success:true};}

 async inviteContext(){

  this.inviteDiagnostic={stage:'connection',connected:this.status==='connected'};

  if(this.status!=='connected'||!this.client.steamID)return null;

  const owner=this.client.steamID.toString(),generation=this.generation;

  if(this.local){try{const context=await this.local.context();if(context.owner!==owner||generation!==this.generation||this.status!=='connected')return null;if(context.appId&&context.lobby!=='0'){this.inviteDiagnostic={stage:'local-lobby',connected:true,appId:context.appId,hasLobby:true};return {...context,kind:'lobby'};}}catch{this.inviteDiagnostic.localUnavailable=true;}}

  const request=(method,...args)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Steam activity is unavailable.')),8000);this.client[method](...args,(error,result)=>{clearTimeout(timer);error?reject(error):resolve(result);});});

  try{

   this.inviteDiagnostic.stage='persona';const personas=await request('getPersonas',[owner]);

   const user=personas?.[owner]||this.client.users?.[owner]||{},appId=String(user.game_played_app_id||user.gameid||'');

   this.inviteDiagnostic={stage:'game',connected:true,appId,hasLobby:!!user.game_lobby_id&&String(user.game_lobby_id)!=='0',hasServer:!!user.game_server_ip,hasGameData:!!user.game_data_blob?.length,personaRichKeys:Array.isArray(user.rich_presence)?user.rich_presence.map(row=>row.key).filter(key=>typeof key==='string'):Object.keys(user.rich_presence||{})};

   if(!/^[1-9]\d{0,9}$/.test(appId)||Number(appId)>4294967295)return null;

   this.inviteDiagnostic.stage='rich-presence';const result=await request('requestRichPresence',Number(appId),[owner]),connect=result.users?.[owner]?.richPresence?.connect;

   this.inviteDiagnostic={...this.inviteDiagnostic,stage:'join-data',hasPresence:!!result.users?.[owner],hasConnect:typeof connect==='string'&&!!connect,presenceKeys:Object.keys(result.users?.[owner]?.richPresence||{})};

   if(generation!==this.generation||this.status!=='connected'||typeof connect!=='string'||!connect||Buffer.byteLength(connect)>255||/["\[\]\r\n<>]/.test(connect))return null;

   this.inviteDiagnostic.stage='ready';return {owner,appId,connect};

  }catch{this.inviteDiagnostic.failed=true;return null;}

 }

 async invite(id,appId){

  id=this.friend(id);const context=await this.inviteContext();this.friend(id);

  if(!context||context.appId!==String(appId))throw Error('Steam has no joinable session for this game. Use an invitation message instead.');

  if(context.kind==='lobby'){

   const generation=this.generation,prepared=await this.local.prepareInvite(id,String(appId),context.owner);this.friend(id);

   if(generation!==this.generation||prepared.owner!==context.owner)throw Error('Steam account changed. Reopen the invitation.');

   return require('./steam-local').queueLobbyInvite(this.client,prepared);

  }

  const message='[gameinvite appid="'+context.appId+'" connect="'+context.connect+'"][/gameinvite]';

  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Steam did not confirm the invitation. Check Steam before retrying.')),10000);this.client._sendUnified('FriendMessages.SendMessage#1',{steamid:id,chat_entry_type:1,message,contains_bbcode:true},(_body,header)=>{clearTimeout(timer);header?.proto?.eresult===1?resolve():reject(Error('Steam rejected the game invitation.'));});});

  return {success:true,kind:'steam-invite'};

 }

 async syncLibrary(){if(this.status!=='connected'||!this.client.steamID)throw Error('Connect Steam first.');const epoch=this.generation,accountId=this.client.steamID.toString();return new Promise((resolve,reject)=>this.client.getUserOwnedApps(this.client.steamID,{includeAppInfo:true},(error,response)=>{if(epoch!==this.generation||this.status!=='connected')return reject(Error('Steam account changed.'));if(error)return reject(Error('Steam library is private or unavailable.'));for(const game of response.apps||[])if(game.name)this.gameNames.set(String(game.appid),String(game.name).slice(0,240));this.notify();const games=(response.apps||[]).filter(game=>game.name&&game.appid!==228980).slice(0,20000).map(game=>({provider:'steam',id:String(game.appid),name:game.name,owned:true,ownershipSource:'Steam connection',portrait:`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.appid}/library_600x900.jpg`,header:`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.appid}/header.jpg`}));this.onLibrary(games,accountId);resolve({count:games.length});}));}

 async achievements(appId){if(this.status!=='connected'||!this.client.steamID)throw Error('Connect Steam to view achievements.');if(!/^\d+$/.test(String(appId)))throw Error('Invalid Steam game.');if(!this.cookies)await new Promise(resolve=>{const done=()=>{clearTimeout(timer);this.client.removeListener('webSession',done);resolve();},timer=setTimeout(done,8000);this.client.once('webSession',done);try{this.client.webLogOn();}catch{done();}});const url=`https://steamcommunity.com/profiles/${steamId(this.client.steamID)}/stats/${appId}/?xml=1`;const response=await this.fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:this.cookies?{Cookie:this.cookies}:undefined});if(!response.ok)throw Error('Steam achievements are unavailable.');const achievements=parseAchievements(await response.text());return {provider:'steam',achievements};}

 close(){this.generation++;clearTimeout(this.notifyTimer);this.pending?.cancelLoginAttempt();this.local?.close();this.client.logOff();this.cookies=null;}

}

module.exports={SteamSocial,parseAchievements,steamId,avatar};

