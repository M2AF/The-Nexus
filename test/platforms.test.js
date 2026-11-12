'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {SteamSocial,parseAchievements}=require('../lib/steam-social');
const {PlatformSessionStore}=require('../lib/platform-session-store');
test('Platform sessions require secure storage, tolerate corrupt files, and encrypt account tokens',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-sessions-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const unavailable=new PlatformSessionStore(directory,{isEncryptionAvailable:()=>false});assert.equal(unavailable.set('steam',{refreshToken:'private'}),false);assert(!fs.existsSync(unavailable.file));
 const safe={isEncryptionAvailable:()=>true,encryptString:text=>Buffer.from(text).map(byte=>byte^123),decryptString:buffer=>Buffer.from(buffer).map(byte=>byte^123).toString()};
 const store=new PlatformSessionStore(directory,safe);assert(store.set('steam',{refreshToken:'private'}));assert(!fs.readFileSync(store.file).includes(Buffer.from('private')));assert.equal(store.get('steam').refreshToken,'private');assert(store.set('steam',null));assert.equal(store.get('steam'),null);
 fs.writeFileSync(store.file,'corrupt');assert.equal(store.get('steam'),null);assert.equal(store.set('__proto__',{}),false);
 const basic=new PlatformSessionStore(directory,{...safe,getSelectedStorageBackend:()=> 'basic_text'});assert.equal(basic.available,false);
});
function fixture(){const client=new EventEmitter(),chat=new EventEmitter(),id='76561198000000001',self='76561198000000002',calls=[];Object.assign(client,{chat,users:{[id]:{player_name:'Friend',persona_state:1,game_name:'A game',avatar_url_medium:'https://avatars.steamstatic.com/example.jpg'}},myFriends:{[id]:3,'76561198000000003':2},steamID:{toString:()=>self},logOff(){calls.push('off');},logOn(args){calls.push(args);},setPersona(){},webLogOn(){},getPersonas(_ids,cb){cb();},getUserOwnedApps(_id,_options,cb){cb(null,{apps:[{appid:10,name:'Owned game'}]});}});chat.getFriendMessageHistory=async()=>({messages:[{sender:id,message:'Hello',server_timestamp:new Date(1000)}]});chat.sendFriendMessage=async(...args)=>calls.push(args);const sessions=[],tokens={};const social=new SteamSocial({client,store:{available:true,get:p=>tokens[p],set:(p,v)=>tokens[p]=v},sessionFactory:()=>{const session=new EventEmitter();session.startWithQR=async()=>({qrChallengeUrl:'https://s.team/q/example'});session.cancelLoginAttempt=()=>{};sessions.push(session);return session;},qr:async()=> 'data:image/png;base64,cXI=',onLibrary:games=>calls.push(games)});return {social,client,id,calls,sessions,tokens};}
test('Steam uses explicit approval, hides disconnected friends, rejects nonfriends, and cancels stale QR sessions',async t=>{
 const {social,client,id,calls,sessions,tokens}=fixture();t.after(()=>social.close());assert.equal(social.public().friends.length,0);await social.connect();assert.equal(social.public().status,'awaiting-approval');assert(!JSON.stringify(social.public()).includes('refreshToken'));
 social.disconnect();sessions[0].refreshToken='stale';sessions[0].emit('authenticated');assert(!tokens.steam);assert.equal(calls.filter(row=>typeof row==='object').length,0);
 await social.connect();sessions[1].refreshToken='secret-token';sessions[1].emit('authenticated');client.emit('loggedOn');assert.equal(social.public().friends.length,1);assert.equal(social.public().friends[0].playing,'A game');assert(!JSON.stringify(social.public()).includes('secret-token'));
 await assert.rejects(social.send('76561198000000003','No'),/friend/);await assert.rejects(social.send(id,'x'.repeat(2001)),/2,000/);await social.send(id,'Hello');assert(calls.some(row=>Array.isArray(row)&&row[0]===id&&row[1]==='Hello'));assert.equal((await social.messages(id)).messages[0].text,'Hello');social.disconnect();assert.equal(social.public().friends.length,0);assert.equal(tokens.steam,null);
});
test('Steam achievement parsing preserves lock state and rejects entities and foreign icon URLs',()=>{
 const result=parseAchievements('<playerstats><achievements><achievement closed="1"><name>Done</name><description>Finish</description><iconClosed>https://avatars.steamstatic.com/icon.jpg</iconClosed></achievement><achievement closed="0"><name>Next</name><iconClosed>https://example.com/no</iconClosed></achievement></achievements></playerstats>');assert.equal(result[0].unlocked,true);assert.equal(result[1].unlocked,false);assert.equal(result[1].icon,null);assert.throws(()=>parseAchievements('<!DOCTYPE x [<!ENTITY y SYSTEM "file:///secret">]><playerstats/>'),/Invalid/);assert.throws(()=>parseAchievements('<response/>'),/does not expose/);
});

const {Contacts,contactGroups}=require('../lib/contacts');
test('Contacts merge by saved account IDs, never by matching names; unlink and restart preserve choices',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-contacts-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const accounts=[{provider:'steam',id:'1',name:'Alex'},{provider:'discord',id:'2',name:'Alex'},{provider:'chainlens',id:'friend',name:'Other name'}];
 const contacts=new Contacts(directory);assert.equal(contactGroups(accounts).length,3);contacts.merge(['steam:1','discord:2']);assert.equal(contactGroups(accounts,contacts.read()).length,2);contacts.merge(['discord:2','chainlens:friend']);assert.equal(contactGroups(accounts,new Contacts(directory).read()).length,1);
 contacts.unmerge('discord:2');assert.equal(contactGroups(accounts,contacts.read()).length,2);assert.deepEqual(new Contacts(directory).read(),[['chainlens:friend','steam:1']]);assert.throws(()=>contacts.merge(['steam:1','file:secret']),/Invalid/);
 const verified=[{from:'steam:1',to:'discord:2',verified:false}];assert.equal(contactGroups(accounts,[],verified).length,3);verified[0].verified=true;assert.equal(contactGroups(accounts,[],verified).length,2);
 assert.equal(contactGroups(accounts.slice(0,1),contacts.read()).length,1);
});

const {preferred}=require('../app/contact-groups');
test('Merged contacts always prefer Discord, then Steam, with ChainLens as fallback regardless of presence or input order',()=>{
 const chainlens={provider:'chainlens',id:'a',name:'ChainLens name',avatar:'https://example.com/chainlens.jpg',online:true},steam={provider:'steam',id:'b',name:'Steam name',online:true},discord={provider:'discord',id:'c',name:'Discord name',online:false};
 for(const accounts of [[chainlens,steam,discord],[discord,chainlens,steam],[steam,discord,chainlens]]){assert.equal(preferred(accounts),discord);assert.equal(contactGroups(accounts,[[...accounts.map(a=>a.provider+':'+a.id)]])[0].members[0],discord);}
 assert.equal(preferred([chainlens,steam]),steam);assert.equal(preferred([chainlens]),chainlens);
});

test('Explicit contact separation overrides verified auto links and survives restart',t=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-split-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const store=new Contacts(directory),accounts=[{provider:'chainlens',id:'a'},{provider:'discord',id:'b'}],links=[{from:'chainlens:a',to:'discord:b',verified:true}];assert.equal(contactGroups(accounts,[],links).length,1);store.unmerge('discord:b');const restored=new Contacts(directory);assert.equal(contactGroups(accounts,restored.read(),links,[...restored.splits]).length,2);restored.merge(['chainlens:a','discord:b']);assert.equal(contactGroups(accounts,restored.read(),links,[...restored.splits]).length,1);});


test('Restored account Steam chat advertises Message and never mistakes a desktop-only preference for a login',async t=>{
 const f=fixture();t.after(()=>f.social.close());f.tokens.steam={mode:'desktop',disabled:false};
 f.social.restore();assert.equal(f.social.public().connected,false);assert.equal(f.calls.length,0);assert.equal(f.sessions.length,0);
 await f.social.connect();f.sessions[0].refreshToken='private-test-token';f.sessions[0].emit('authenticated');f.client.emit('loggedOn');
 const state=await f.social.refresh();assert.equal(state.mode,'account');assert.equal(state.canMessage,true);
 assert.equal(state.friends[0].canMessage,true);assert.equal(state.friends[0].externalChat,false);
 f.client.chat.getFriendMessageHistory=async()=>({messages:[{sender:f.client.steamID,message:'My reply',server_timestamp:new Date(2000)},{sender:f.id,message:'Incoming',server_timestamp:new Date(1000)}]});
 const result=await f.social.messages(f.id);assert.deepEqual(result.messages.map(row=>[row.sender,row.text]),[[f.id,'Incoming'],[f.client.steamID.toString(),'My reply']]);
 await assert.rejects(f.social.send(f.id,'bad\0text'),/2,000/);
});

test('Steam chat discards a history response after disconnect or account change',async t=>{
 const f=fixture();t.after(()=>f.social.close());f.social.status='connected';let finish;
 f.client.chat.getFriendMessageHistory=()=>new Promise(resolve=>{finish=resolve;});
 const request=f.social.messages(f.id);f.social.disconnect();finish({messages:[{sender:f.id,message:'Stale',server_timestamp:new Date()}]});
 await assert.rejects(request,/Connect Steam|account changed/);
});
