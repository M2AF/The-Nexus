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
 await social.accept({provider:'xbox',accountId:xbox,token:'private-token',userHash:'123',expiresAt:100000});const state=social.public();assert.equal(state.friends[0].playing,'Forza');assert.equal(state.friends[0].online,true);assert.equal(state.friends[0].name,'Friend');assert(state.friends[0].avatar);assert.equal(state.canMessage,false);assert(!JSON.stringify(state).includes('private-token'));assert.equal(social.disconnect().connected,false);
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
