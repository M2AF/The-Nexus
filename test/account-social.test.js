'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {AccountSocial}=require('../lib/account-social');
const store=()=>{const data={};return {get:key=>data[key],set:(key,value)=>{data[key]=value;return true;}};};
const epic='a'.repeat(32),friend='b'.repeat(32),blocked='c'.repeat(32),xbox='2533274800000001';
test('Xbox keeps the gamertag and friends through profile throttling, honors Retry-After, and caches profiles',async()=>{
 let clock=1000,profileCalls=0,throttle=true;const peer='2533274800000002',saved=store();
 const social=new AccountSocial({provider:'xbox',store:saved,now:()=>clock,fetchImpl:async(url,options)=>{
  if(url.includes('peoplehub.xboxlive'))return {ok:false,status:403};
  if(url.includes('social.xboxlive'))return {ok:true,json:async()=>({people:[{xuid:peer}],totalCount:1})};
  if(url.includes('userpresence'))return {ok:true,json:async()=>[{xuid:peer,state:'Online',devices:[]}]};
  profileCalls++;const ids=JSON.parse(options.body).userIds;
  if(ids.includes(peer)&&throttle)return {ok:false,status:429,headers:{get:()=> '120'}};
  return {ok:true,json:async()=>({profileUsers:ids.map(id=>({id,settings:[{id:'Gamertag',value:id===xbox?'Real owner':'Real friend'}]}))})};
 }});
 await social.accept({provider:'xbox',accountId:xbox,token:'private-token',userHash:'123',expiresAt:10000000});
 assert.equal(social.public().name,'Real owner');assert.equal(social.public().friends.length,1);assert.equal(social.public().friends[0].online,true);assert.match(social.public().error,/rate limited/);assert.equal(saved.get('xbox').name,'Real owner');assert.equal(profileCalls,2);
 clock+=60000;await social.refresh(true);assert.equal(profileCalls,2);assert.equal(social.public().name,'Real owner');
 throttle=false;clock+=60001;await social.refresh(true);assert.equal(profileCalls,3);assert.equal(social.public().friends[0].name,'Real friend');assert.equal(social.public().error,'');
 await social.refresh(true);assert.equal(profileCalls,3);
});
test('Xbox gamertag can load even when the friends service fails',async()=>{
 const social=new AccountSocial({provider:'xbox',store:store(),now:()=>1000,fetchImpl:async url=>url.includes('profile.xboxlive')?{ok:true,json:async()=>({profileUsers:[{id:xbox,settings:[{id:'Gamertag',value:'Real owner'}]}]})}:{ok:false,status:503}});
 await social.accept({provider:'xbox',accountId:xbox,token:'private-token',userHash:'123',expiresAt:100000});assert.equal(social.public().name,'Real owner');assert.match(social.public().error,/temporarily unavailable/);
});
test('Epic friends exclude blocked accounts, keep unknown presence honest and never expose tokens',async()=>{
 let calls=0,clock=1000;const social=new AccountSocial({provider:'epic',store:store(),now:()=>clock,fetchImpl:async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer private-token');assert.equal(options.redirect,'error');return {ok:true,json:async()=>url.includes('/friends/')?{friends:[{accountId:friend},{accountId:blocked}],blockList:[{accountId:blocked}]}:[{accountId:epic,displayName:'Owner'},{accountId:friend,displayName:'Friend'}]};}});
 await social.accept({provider:'epic',accountId:epic,token:'private-token',expiresAt:100000});const state=social.public();assert.equal(state.name,'Owner');assert.deepEqual(state.friends.map(row=>row.id),[friend]);assert.equal(state.friends[0].online,null);assert.equal(state.friends[0].canMessage,false);assert(!JSON.stringify(state).includes('private-token'));await social.refresh();assert.equal(calls,2);clock=100001;assert.equal(social.public().connected,false);assert.deepEqual(social.public().friends,[]);
});
test('Xbox uses authenticated fixed endpoints and maps real profile/presence fields',async()=>{
 const social=new AccountSocial({provider:'xbox',store:store(),now:()=>1000,fetchImpl:async(url,options)=>{assert.equal(options.headers.Authorization,'XBL3.0 x=123;private-token');let data;if(url.includes('social.xboxlive'))data={people:[{xuid:'2533274800000002'}],totalCount:1};else if(url.includes('profile.xboxlive'))data={profileUsers:[{id:xbox,settings:[{id:'Gamertag',value:'Owner'}]},{id:'2533274800000002',settings:[{id:'Gamertag',value:'Friend'},{id:'GameDisplayPicRaw',value:'https://images-eds.xboxlive.com/image/test'}]}]};else data=[{xuid:'2533274800000002',state:'Online',devices:[{titles:[{name:'Forza',state:'active'}]}]}];return {ok:true,json:async()=>data};}});
 await social.accept({provider:'xbox',accountId:xbox,token:'private-token',userHash:'123',expiresAt:100000});const state=social.public();assert.equal(state.friends[0].playing,'Forza');assert.equal(state.friends[0].online,true);assert.equal(state.friends[0].name,'Friend');assert(state.friends[0].avatar);assert.equal(state.canMessage,true);assert.equal(state.friends[0].canMessage,true);assert(!JSON.stringify(state).includes('private-token'));assert.equal(social.disconnect().connected,false);
});
test('Disconnect during refresh discards stale data and invalid sessions fail closed',async()=>{
 let resolve;const waiting=new Promise(done=>resolve=done),social=new AccountSocial({provider:'epic',store:store(),now:()=>1000,fetchImpl:async()=>{await waiting;return {ok:true,json:async()=>({friends:[],blockList:[]})};}});
 await assert.rejects(social.accept({provider:'epic',accountId:epic,token:'bad\nheader',expiresAt:100000}));const pending=social.accept({provider:'epic',accountId:epic,token:'private-token',expiresAt:100000});social.disconnect();resolve();await pending;assert.equal(social.public().connected,false);assert.deepEqual(social.public().friends,[]);
});

test('Xbox PeopleHub loads names, pictures and game presence without friend profile requests and retains names on restart',async()=>{
 const peer='2533274800000002',saved=store();let fail=false,clock=1000,calls=[];
 const fetchImpl=async(url,options)=>{calls.push(url);if(url.includes('peoplehub.xboxlive')){assert.equal(options.headers['x-xbl-contract-version'],'7');return fail?{ok:false,status:503}:{ok:true,json:async()=>({people:[{xuid:peer,isFriend:true,gamertag:'Legacy name',uniqueModernGamertag:'Real friend#1234',displayPicRaw:'https://images-eds.xboxlive.com/image/test',presenceState:'Online',presenceDetails:[{State:'active',IsGame:true,PresenceText:'Gears of War: E-Day - In campaign'}]},{xuid:'2533274800000003',isFriend:false,gamertag:'Not a friend'},{xuid:peer,gamertag:'Duplicate'}]})};}
 if(url.includes('social.xboxlive'))return {ok:true,json:async()=>({people:[{xuid:peer}],totalCount:1})};
 if(url.includes('userpresence'))return {ok:true,json:async()=>[{xuid:peer,state:'Offline'}]};
 throw Error('No profile lookup should be needed');};
 const social=new AccountSocial({provider:'xbox',store:saved,now:()=>clock,fetchImpl});
 await social.accept({provider:'xbox',accountId:xbox,name:'Real owner',token:'private-token',userHash:'123',expiresAt:10000000});
 assert.equal(calls.length,1);assert.equal(social.public().friends.length,1);assert.equal(social.public().friends[0].name,'Real friend#1234');assert(social.public().friends[0].avatar);assert.equal(social.public().friends[0].playing,'Gears of War: E-Day');
 fail=true;calls=[];const restored=new AccountSocial({provider:'xbox',store:saved,now:()=>clock,fetchImpl});await restored.accept(saved.get('xbox'));
 assert.equal(restored.public().friends[0].name,'Real friend#1234');assert(restored.public().friends[0].avatar);assert.equal(restored.public().friends[0].online,false);assert(!calls.some(url=>url.includes('profile.xboxlive')));
 clock+=600001;await restored.refresh(true);assert.equal(restored.public().friends[0].name,'Real friend#1234');
 const other=new AccountSocial({provider:'xbox',store:store(),now:()=>clock,fetchImpl});await other.accept({...saved.get('xbox'),accountId:'2533274800000099'});assert.equal(other.public().friends[0].name,'Xbox friend \u00b7 0002');
});
// Fake timers: record scheduled renewals so tests can fire them on demand.
const timers=()=>{const pending=new Map();let id=0;return {pending,set:(fn,ms)=>{pending.set(++id,{fn,ms});return id;},clear:key=>pending.delete(key),fire:()=>{const [key,{fn}]=[...pending][0];pending.delete(key);fn();}};};
const epicFetch=async url=>url.includes('/friends/')?{ok:true,json:async()=>({friends:[]})}:{ok:true,json:async()=>[{accountId:epic,displayName:'Me'}]};
test('An expired saved session with a refresh token renews on restore instead of disconnecting',async()=>{
 let clock=10_000_000;const saved=store(),calls=[];saved.set('epic',{provider:'epic',accountId:epic,token:'old',expiresAt:clock-1,refreshToken:'r1',refreshExpiresAt:clock+3_600_000});
 const social=new AccountSocial({provider:'epic',store:saved,now:()=>clock,fetchImpl:epicFetch,timers:timers(),renew:async request=>{calls.push(request);return {provider:'epic',accountId:epic,token:'new',expiresAt:clock+7_200_000,refreshToken:'r2'};}});
 assert.equal(social.restore().status,'connecting');await social.renewing;await social.loading;
 assert.deepEqual(calls,[{provider:'epic',accountId:epic,refreshToken:'r1'}]);
 const state=social.public();assert.equal(state.status,'connected');assert.equal(state.name,'Me');
 assert.equal(saved.get('epic').token,'new');assert.equal(saved.get('epic').refreshToken,'r2');
});
test('A session without a refresh token, or with an expired one, is still discarded on restore',()=>{
 for(const extra of [{},{refreshToken:'r1',refreshExpiresAt:999}]){const saved=store();saved.set('epic',{provider:'epic',accountId:epic,token:'old',expiresAt:500,...extra});
  const social=new AccountSocial({provider:'epic',store:saved,now:()=>1000,renew:async()=>{throw Error('should not renew');}});assert.equal(social.restore().status,'disconnected');assert.equal(saved.get('epic'),null);}
});
test('Renewal is scheduled before expiry and keeps the old refresh token when the provider does not rotate it',async()=>{
 let clock=1000;const saved=store(),clock2=timers();
 const social=new AccountSocial({provider:'epic',store:saved,now:()=>clock,fetchImpl:epicFetch,timers:clock2,renew:async()=>({provider:'epic',accountId:epic,token:'t2',expiresAt:clock+3_600_000})});
 await social.accept({provider:'epic',accountId:epic,token:'t1',expiresAt:clock+3_600_000,refreshToken:'r1'});
 const [{ms}]=[...clock2.pending.values()];assert.equal(ms,3_600_000-300_000);
 clock+=3_400_000;clock2.fire();await social.renewing;await social.loading;
 assert.equal(saved.get('epic').token,'t2');assert.equal(saved.get('epic').refreshToken,'r1');assert.equal(social.public().status,'connected');
});
test('A revoked grant clears the account; a transient failure keeps the refresh token and retries later',async()=>{
 let clock=1000;
 const revoked=store();revoked.set('epic',{provider:'epic',accountId:epic,token:'old',expiresAt:500,refreshToken:'r1'});
 const a=new AccountSocial({provider:'epic',store:revoked,now:()=>clock,timers:timers(),renew:async()=>{throw Object.assign(Error('Your platform sign-in expired.'),{reconnect:true});}});
 a.restore();await a.renewing;assert.equal(a.public().status,'disconnected');assert.equal(revoked.get('epic'),null);assert.match(a.public().error,/Connect it again/);
 const flaky=store(),t=timers();flaky.set('epic',{provider:'epic',accountId:epic,token:'old',expiresAt:500,refreshToken:'r1'});let attempts=0;
 const b=new AccountSocial({provider:'epic',store:flaky,now:()=>clock,fetchImpl:epicFetch,timers:t,renew:async()=>{if(++attempts===1)throw Error('Sign in to ChainLens to continue.');return {provider:'epic',accountId:epic,token:'new',expiresAt:clock+3_600_000};}});
 b.restore();await b.renewing;assert.equal(b.public().status,'expired');assert.equal(flaky.get('epic').refreshToken,'r1');assert.match(b.public().error,/Retrying automatically/);
 await b.refresh(true);assert.equal(attempts,1,'refresh respects the retry delay');
 clock+=300_000;await b.refresh(true);assert.equal(attempts,2);assert.equal(b.public().status,'connected');assert.equal(t.pending.size,1);
});
test('Disconnecting during a renewal wins, and a renewal for another account is rejected',async()=>{
 let release;const saved=store();saved.set('xbox',{provider:'xbox',accountId:xbox,token:'old',userHash:'1',expiresAt:500,refreshToken:'r1'});
 const a=new AccountSocial({provider:'xbox',store:saved,now:()=>1000,timers:timers(),renew:()=>new Promise(resolve=>release=resolve)});
 a.restore();a.disconnect();release({provider:'xbox',accountId:xbox,token:'new',userHash:'1',expiresAt:9e12});await new Promise(setImmediate);
 assert.equal(a.public().status,'disconnected');assert.equal(saved.get('xbox'),null);
 const other=store();other.set('xbox',{provider:'xbox',accountId:xbox,token:'old',userHash:'1',expiresAt:500,refreshToken:'r1'});
 const b=new AccountSocial({provider:'xbox',store:other,now:()=>1000,timers:timers(),renew:async()=>({provider:'xbox',accountId:'2533274800000009',token:'new',userHash:'1',expiresAt:9e12})});
 b.restore();await b.renewing;assert.equal(b.public().status,'disconnected');assert.equal(other.get('xbox'),null);
});

test('Xbox messages read the friend conversation, send text parts, and reject non-friends and Epic',async()=>{
 const peer='2533274800000002',calls=[];let chat={ok:true,status:200,json:async()=>({messages:[
  {messageId:'1',sender:peer,timestamp:'2026-11-16T10:00:00Z',contentPayload:{content:{parts:[{contentType:'text',version:0,text:'hi '},{contentType:'text',version:0,text:'there'}]}}},
  {messageId:'2',sender:xbox,timestamp:'2026-11-16T10:01:00Z',contentPayload:{content:{parts:[{contentType:'text',version:0,text:'yo'}]}}},
  {messageId:'3',sender:peer,timestamp:'2026-11-16T10:02:00Z',isDeleted:true,contentPayload:{content:{parts:[{contentType:'text',text:'gone'}]}}},
  {messageId:'4',sender:'2533274800000077',timestamp:'2026-11-16T10:03:00Z',contentPayload:{content:{parts:[{contentType:'text',text:'stranger'}]}}},
  {messageId:'5',sender:peer,timestamp:'2026-11-16T10:04:00Z',contentPayload:{content:{parts:[{contentType:'image',locator:'x'}]}}}]})};
 const social=new AccountSocial({provider:'xbox',store:store(),now:()=>1000,fetchImpl:async(url,options)=>{calls.push({url,options});if(url.includes('peoplehub.xboxlive'))return {ok:true,json:async()=>({people:[{xuid:peer,isFriend:true,gamertag:'Friend'}]})};if(url.includes('xblmessaging'))return options.method==='POST'?{ok:true,json:async()=>({messageId:'9',conversationId:'c'})}:chat;return {ok:true,json:async()=>({profileUsers:[]})};}});
 await social.accept({provider:'xbox',accountId:xbox,token:'private-token',userHash:'123',expiresAt:100000,name:'Owner'});
 const result=await social.messages(peer),read=calls.find(call=>call.url.includes('xblmessaging'));
 assert.equal(read.url,'https://xblmessaging.xboxlive.com/network/xbox/users/me/conversations/users/xuid('+peer+')?maxItems=50');assert.equal(read.options.method,'GET');assert.equal(read.options.headers['x-xbl-contract-version'],'1');assert.equal(read.options.headers.Authorization,'XBL3.0 x=123;private-token');
 assert.deepEqual(result.messages.map(m=>[m.sender,m.text]),[[peer,'hi there'],[xbox,'yo'],[peer,'[This Xbox message type is not supported in The Nexus]']]);assert.equal(result.messages[0].at,Date.parse('2026-11-16T10:00:00Z'));
 assert.deepEqual(await social.send(peer,'gg'),{success:true});const sent=calls.at(-1);
 assert.equal(sent.options.method,'POST');assert.equal(sent.url,'https://xblmessaging.xboxlive.com/network/xbox/users/me/conversations/users/xuid('+peer+')');assert.deepEqual(JSON.parse(sent.options.body),{parts:[{contentType:'text',version:0,text:'gg'}]});
 const before=calls.length;
 await assert.rejects(social.send(peer,'x'.repeat(257)),/up to 256/);await assert.rejects(social.send(peer,'  '),/up to 256/);
 await assert.rejects(social.messages('2533274800000077'),/current Xbox friend/);await assert.rejects(social.send('2533274800000077','hi'),/current Xbox friend/);assert.equal(calls.length,before);
 chat={ok:false,status:404};assert.deepEqual(await social.messages(peer),{messages:[]});
 chat={ok:false,status:403};await assert.rejects(social.messages(peer),/privacy settings/);
 chat={ok:false,status:500};await assert.rejects(social.messages(peer),/temporarily unavailable/);
 social.disconnect();await assert.rejects(social.messages(peer),/expired/);
 const epicSocial=new AccountSocial({provider:'epic',store:store(),fetchImpl:async()=>({ok:true,json:async()=>({})})});assert.equal(epicSocial.public().canMessage,false);await assert.rejects(epicSocial.messages(friend),/Epic Games messaging is not available/);
});
