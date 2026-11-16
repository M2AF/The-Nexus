'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');const {SteamSocial}=require('../lib/steam-social');
function fixture(){const owner='76561198000000002',friend='76561198000000001',client=new EventEmitter(),chat=new EventEmitter(),sends=[];Object.assign(client,{chat,steamID:{toString:()=>owner},users:{[owner]:{gameid:'570'}},myFriends:{[friend]:3},getPersonas(ids,callback){callback(null,{});},requestRichPresence(appId,ids,callback){callback(null,{users:{[owner]:{richPresence:{connect:'+join 123'}}}});},_sendUnified(method,body,callback){sends.push({method,body});callback({}, {proto:{eresult:1}});},logOff(){}});const social=new SteamSocial({client,store:{get:()=>null,set:()=>false},sessionFactory:()=>{},qr:()=>{}});social.status='connected';return {social,client,owner,friend,sends};}
test('Steam invitation uses fresh owned activity and join data, a game-invite payload, and server acknowledgement',async()=>{const f=fixture();await f.social.invite(f.friend,'570');assert.equal(f.sends.length,1);assert.equal(f.sends[0].method,'FriendMessages.SendMessage#1');assert.equal(f.sends[0].body.message,'[gameinvite appid="570" connect="+join 123"][/gameinvite]');assert.equal(f.sends[0].body.contains_bbcode,true);assert.equal(f.sends[0].body.steamid,f.friend);});
test('Steam refuses strangers, mismatched games, unsafe join text, expired activity and rejected sends',async()=>{const f=fixture();await assert.rejects(f.social.invite('76561198000000003','570'),/current Steam friend/);await assert.rejects(f.social.invite(f.friend,'440'),/no joinable/);f.client.requestRichPresence=(app,ids,cb)=>cb(null,{users:{[f.owner]:{richPresence:{connect:'bad" [url]'}}}});await assert.rejects(f.social.invite(f.friend,'570'),/no joinable/);assert.equal(f.sends.length,0);f.client.requestRichPresence=(app,ids,cb)=>{f.social.generation++;cb(null,{users:{[f.owner]:{richPresence:{connect:'safe'}}}});};assert.equal(await f.social.inviteContext(),null);f.client.requestRichPresence=(app,ids,cb)=>cb(null,{users:{[f.owner]:{richPresence:{connect:'safe'}}}});f.client._sendUnified=(method,body,cb)=>cb({}, {proto:{eresult:15}});await assert.rejects(f.social.invite(f.friend,'570'),/rejected/);});

test('Steam lobby invite rechecks the local session and sends the Valve lobby protocol without a chat fallback',async()=>{
 const f=fixture(),lobby='109775241234567890',sent=[];let prepares=0;
 f.social.local={context:async()=>({owner:f.owner,appId:'1374490',lobby}),prepareInvite:async(id,appId,owner)=>{prepares++;return {id,appId,owner,lobby};}};
 f.client._send=(header,body)=>sent.push({header,body});
 const result=await f.social.invite(f.friend,'1374490');assert.equal(result.kind,'steam-lobby-queued');assert.equal(result.receiptConfirmed,false);assert.equal(prepares,1);assert.equal(f.sends.length,0);assert.equal(sent.length,1);assert.equal(sent[0].header.msg,6621);
 const schema=require('steam-user/protobufs/generated/_load.js'),body=schema.CMsgClientMMSInviteToLobby.decode(sent[0].body);
 assert.equal(body.app_id,1374490);assert.equal(body.steam_id_lobby.toString(),lobby);assert.equal(body.steam_id_user_invited.toString(),f.friend);
 f.social.local.prepareInvite=async()=>{f.social.generation++;return {owner:f.owner,appId:'1374490',id:f.friend,lobby};};await assert.rejects(f.social.invite(f.friend,'1374490'),/account changed/);assert.equal(sent.length,1);
 f.social.local.context=async()=>({owner:'76561198000000003',appId:'1374490',lobby});assert.equal(await f.social.inviteContext(),null);
});

test('Local Steam lobby preparation rejects stale accounts, nonfriends and unavailable lobbies',()=>{
 const {SteamLocal,queueLobbyInvite}=require('../lib/steam-local'),owner='76561198000000002',id='76561198000000001',context={owner,appId:'1374490',lobby:'109775241234567890'};
 const local=Object.create(SteamLocal.prototype);local.context=()=>context;local.relationship=()=>3;
 assert.equal(local.prepareInvite(id,'1374490',owner).id,id);
 assert.throws(()=>local.prepareInvite(id,'570',owner),/not exposing/);assert.throws(()=>local.prepareInvite(id,'1374490','76561198000000003'),/account changed/);
 local.relationship=()=>2;assert.throws(()=>local.prepareInvite(id,'1374490',owner),/current Steam friend/);local.relationship=()=>3;context.lobby='0';assert.throws(()=>local.prepareInvite(id,'1374490',owner),/not exposing/);
 assert.throws(()=>queueLobbyInvite({steamID:{toString:()=>owner}},{...context,id,lobby:'-1'}),/Invalid/);
});

test('Steam sign-in uses the tested invisible chat mode and does not start an unsolicited web login',()=>{
 const f=fixture(),calls=[];f.client.setPersona=value=>calls.push(['persona',value]);f.client.setUIMode=value=>calls.push(['ui',value]);f.client.webLogOn=()=>calls.push(['web']);f.client.getUserOwnedApps=(id,options,cb)=>cb(null,{apps:[]});f.client.emit('loggedOn');
 assert.deepEqual(calls,[['ui',4],['persona',7]]);f.social.close();
});
