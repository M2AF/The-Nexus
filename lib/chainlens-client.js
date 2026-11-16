'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const ORIGIN='https://www.chainlensnft.info',CLIENT='nexus-desktop';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validGif=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname==='giphy.com'||url.hostname.endsWith('.giphy.com'));}catch{return false;}};
const uuid=value=>{if(typeof value!=='string'||!UUID.test(value))throw Error('Enter a valid ChainLens ID.');return value.toLowerCase();};
const number=value=>{if(!/^[1-9]\d*$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw Error('Invalid message or friendship.');return String(value);};
class ChainLensClient{
 constructor({directory,safeStorage,openExternal,onChange=()=>{},origin=ORIGIN,allowLoopback=false,fetchImpl=globalThis.fetch}){
  const target=new URL(origin);if(target.origin!==ORIGIN && !(allowLoopback&&target.protocol==='http:'&&target.hostname==='127.0.0.1'&&!target.username&&!target.password))throw Error('Untrusted ChainLens origin.');
  this.origin=target.origin;this.file=path.join(directory,'chainlens-session.enc');this.safeStorage=safeStorage;this.openExternal=openExternal;this.onChange=onChange;this.fetch=fetchImpl;this.credential=null;this.account=null;this.access=null;this.pending=null;this.error='';this.remembered=false;this.presenceId=crypto.randomUUID();this.loginEpoch=0;this.authRevision=0;
 }
 public(){return {signedIn:!!this.account,user:this.account,access:this.access,gifSearch:!!this.gifSearch,pending:!!this.pending||!!this.starting,error:this.error,remembered:this.remembered,expiresAt:this.credential?.expires||null};}
 notify(){this.onChange(this.public());}
 async request(endpoint,{method='GET',body,authenticated=true}={}){
  if(!endpoint.startsWith('/api/nexus/'))throw Error('Unsupported ChainLens endpoint.');
  const token=authenticated?this.credential?.token:null;
  if(authenticated&&(!token||this.credential.expires<=Date.now())){if(token){this.clearLocal();this.error='Your ChainLens session expired. Sign in again.';this.notify();}throw Error('Sign in to ChainLens to continue.');}
  let response;
  try{response=await this.fetch(this.origin+endpoint,{method,headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000),redirect:'error'});}catch{throw Error('Could not reach ChainLens. Check your connection and try again.');}
  if(authenticated&&token!==this.credential?.token)throw Error('Your session changed. Try again.');
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('ChainLens sign-in is temporarily unavailable. Try again later.');
  const text=await response.text();if(text.length>32*1024*1024)throw Error('ChainLens returned too much data.');let data;try{data=JSON.parse(text);}catch{throw Error('ChainLens returned an invalid response.');}
  if(!response.ok){if(response.status===401&&authenticated){this.clearLocal();this.error='Your ChainLens session expired. Sign in again.';this.notify();}throw Error(String(data.error||'ChainLens request failed.').replace(/[\u0000-\u001f]/g,' ').slice(0,240));}
  return data;
 }
 async persist(){
  this.remembered=false;if(!this.credential)return;
  if(!await this.safeStorage.isAsyncEncryptionAvailable())return;
  const credential=this.credential;const encrypted=await this.safeStorage.encryptStringAsync(JSON.stringify({origin:this.origin,...credential}));if(this.credential?.token!==credential.token)return;
  fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',encrypted);fs.renameSync(this.file+'.tmp',this.file);this.remembered=true;
 }
 clearLocal(){this.authRevision++;this.credential=null;this.account=null;this.access=null;this.gifSearch=false;this.remembered=false;try{fs.unlinkSync(this.file);}catch{/* no persisted session */}}
 async refreshIdentity(){
  const result=await this.request('/api/nexus/me');const id=uuid(result.user?.id);
  if(this.credential.userId && id!==this.credential.userId)throw Error('Account identity changed. Sign in again.');
  this.account={id,username:typeof result.user.username==='string'?result.user.username.slice(0,32):null,name:String(result.user.name||'ChainLens player').slice(0,64),avatar_url:result.user.avatar_url||null,avatar_nft_key:result.user.avatar_nft_key||null};this.access=result.access||{};this.gifSearch=result.gif_search===true;this.error='';this.notify();return this.public();
 }
 async restore(){
  if(!fs.existsSync(this.file))return this.public();
  const revision=this.authRevision;let restoredToken=null;
  try{const decoded=await this.safeStorage.decryptStringAsync(fs.readFileSync(this.file)),saved=JSON.parse(decoded.result);if(revision!==this.authRevision)return this.public();
   if(saved.origin!==this.origin||!/^nxs_[a-f0-9]{64}$/.test(saved.token||'')||!Number.isFinite(saved.expires)||saved.expires<=Date.now()){this.clearLocal();return this.public();}
   this.credential={token:saved.token,expires:saved.expires,userId:uuid(saved.userId)};restoredToken=saved.token;this.authRevision++;this.remembered=true;await this.refreshIdentity();if(decoded.shouldReEncrypt)await this.persist();
  }catch{if(!this.credential||this.credential.token===restoredToken){this.account=null;this.error='Could not restore your ChainLens session. Sign in again or retry your connection.';this.notify();}}return this.public();
 }
 cancelLogin(){this.loginEpoch++;this.starting=false;if(this.pending){clearTimeout(this.pending.timer);this.pending.server.close();this.pending=null;}this.notify();}
 async login(){
  if(this.pending||this.starting)return this.public();this.starting=true;const epoch=++this.loginEpoch;this.error='';this.notify();try{
  const config=await this.request('/api/nexus/config',{authenticated:false});
  if(epoch!==this.loginEpoch)return this.public();
  if(!config.enabled||config.client_id!==CLIENT||config.scope!=='social'||config.authorization_endpoint!==this.origin+'/auth/nexus'||config.token_endpoint!==this.origin+'/api/nexus/token')throw Error('ChainLens sign-in is temporarily unavailable.');
  const state=crypto.randomBytes(32).toString('hex'),verifier=crypto.randomBytes(32).toString('base64url'),challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  const server=http.createServer(async(req,res)=>{
   const pending=this.pending;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'");res.setHeader('Referrer-Policy','no-referrer');
   let url;try{url=new URL(req.url,pending?.redirect||'http://127.0.0.1');}catch{res.writeHead(400);return res.end('Invalid request.');}
   if(!pending||pending.used||req.method!=='GET'||req.headers.host!==new URL(pending.redirect).host||url.pathname!=='/chainlens/callback'||url.searchParams.getAll('state').length!==1||url.searchParams.get('state')!==pending.state||url.searchParams.getAll('code').length!==1||!/^[a-f0-9]{64}$/.test(url.searchParams.get('code')||'')){res.writeHead(400);return res.end('This sign-in request is invalid. Return to The Nexus and try again.');}
   pending.used=true;
   try{
    const result=await this.request('/api/nexus/token',{method:'POST',authenticated:false,body:{grant_type:'authorization_code',client_id:CLIENT,redirect_uri:pending.redirect,code:url.searchParams.get('code'),code_verifier:pending.verifier}});
    if(!/^nxs_[a-f0-9]{64}$/.test(result.access_token||'')||result.scope!=='social'||!Number.isFinite(result.expires_in)||result.expires_in<=0||result.expires_in>604800)throw Error('Invalid sign-in response.');
    if(this.pending!==pending||epoch!==this.loginEpoch)throw Error('Sign-in was canceled.');
    this.credential={token:result.access_token,expires:Date.now()+result.expires_in*1000,userId:uuid(result.user?.id)};this.authRevision++;
    await this.refreshIdentity();if(this.pending!==pending||epoch!==this.loginEpoch)throw Error('Sign-in was canceled.');await this.persist();res.end('<!doctype html><title>Connected to The Nexus</title><h1>You are connected.</h1><p>Return to The Nexus to chat with your friends. You can close this tab.</p>');
   }catch(error){this.clearLocal();this.error=error.message;res.writeHead(400);res.end('<!doctype html><title>Sign-in incomplete</title><h1>Sign-in could not finish.</h1><p>Return to The Nexus and try again.</p>');}
   finally{this.cancelLogin();this.notify();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  if(epoch!==this.loginEpoch){server.close();return this.public();}
  const redirect=`http://127.0.0.1:${server.address().port}/chainlens/callback`;
  this.pending={server,redirect,state,verifier,used:false,timer:setTimeout(()=>{this.error='Sign-in timed out. Please try again.';this.cancelLogin();},180000)};
  const url=new URL('/auth/nexus',this.origin);url.search=new URLSearchParams({client_id:CLIENT,redirect_uri:redirect,response_type:'code',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
  try{await this.openExternal(url.href);this.notify();return this.public();}catch{this.cancelLogin();throw Error('Could not open your browser. Try again.');}
  }catch(error){if(epoch===this.loginEpoch)this.error=error.message;throw error;}finally{if(epoch===this.loginEpoch)this.starting=false;this.notify();}
 }
 async logout(){this.cancelLogin();let offline=false;if(this.credential){try{await this.action('presence',{active:false});await this.request('/api/nexus/logout',{method:'POST',body:{}});}catch{offline=true;}}this.clearLocal();this.error=offline?'Signed out on this PC. The server session will expire automatically if it could not be revoked.':'';this.notify();return this.public();}
 async linkIdentity(provider,expectedId){
  if(!['steam','discord','xbox','epic'].includes(provider))throw Error('Unsupported platform.');
  const result=await this.request('/api/nexus/identities/link/'+provider,{method:'POST',body:expectedId?{expectedId}:{}});
  const url=new URL(result.authorization_url),hosts={steam:'steamcommunity.com',discord:'discord.com',xbox:'login.microsoftonline.com',epic:'www.epicgames.com'};
  if(url.protocol!=='https:'||url.hostname!==hosts[provider]||url.username||url.password||url.port||! /^[a-f0-9]{64}$/.test(result.intent_id||''))throw Error('Invalid platform authorization response.');
  await this.openExternal(url.href);return {intent_id:result.intent_id,expires_at:result.expires_at};
 }
 async claimIdentitySession(intentId){if(!/^[a-f0-9]{64}$/.test(intentId||''))throw Error('Invalid link request.');return this.request('/api/nexus/identities/link/'+intentId+'/session');}
 async action(action,args={}){
  const friend=()=>uuid(args.friendId),friendship=()=>number(args.friendshipId);
  switch(action){
   case 'identities':return this.request('/api/nexus/identities');
   case 'identityFriends':return this.request('/api/nexus/identities/friends');
   case 'identityStatus':if(!/^[a-f0-9]{64}$/.test(args.intentId||''))throw Error('Invalid link request.');return this.request('/api/nexus/identities/link/'+args.intentId);
   case 'identityUnlink':if(!['steam','discord','xbox','epic'].includes(args.provider))throw Error('Unsupported platform.');return this.request('/api/nexus/identities/'+args.provider,{method:'DELETE'});
   case 'friends':return this.request('/api/nexus/social/friends');
   case 'addFriend':return this.request('/api/nexus/social/friends',{method:'POST',body:{chainlens_id:uuid(args.chainlensId)}});
   case 'acceptFriend':return this.request(`/api/nexus/social/friends/${friendship()}/accept`,{method:'POST',body:{}});
   case 'removeFriend':return this.request(`/api/nexus/social/friends/${friendship()}`,{method:'DELETE'});
   case 'messages':return this.request(`/api/nexus/social/friends/${friend()}/messages${args.after?'?after='+number(args.after):''}`);
   case 'send':{const type=args.type;if(!['text','gif'].includes(type)||typeof args.content!=='string')throw Error('Choose text or a GIF to send.');const content=args.content.trim();if(type==='text'&&(!content||content.length>500))throw Error('Write a message of up to 500 characters.');if(type==='gif'&&(content.length>2048||!validGif(content)))throw Error('Choose a GIPHY GIF or paste a valid GIPHY media link.');return this.request(`/api/nexus/social/friends/${friend()}/messages`,{method:'POST',body:{type,content}});}
   case 'deleteMessage':return this.request(`/api/nexus/social/friends/${friend()}/messages/${number(args.messageId)}`,{method:'DELETE'});
   case 'presence':return this.request('/api/nexus/social/presence',{method:'POST',body:{session_id:this.presenceId,active:args.active===true,in_world:false}});
   case 'online':return this.request('/api/nexus/social/presence');
   case 'unread':return this.request('/api/nexus/social/unread');
   case 'markRead':return this.request('/api/nexus/social/read',{method:'POST',body:{friend_id:friend(),last_read_id:Number(number(args.lastReadId))}});
   case 'gifs':return this.request('/api/nexus/gifs?q='+encodeURIComponent(String(args.query||'').trim().slice(0,120)));
   default:throw Error('Unsupported social operation.');
  }
 }
 close(){this.cancelLogin();}
}
module.exports={ChainLensClient,validGif,ORIGIN};
