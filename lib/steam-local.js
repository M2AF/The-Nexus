'use strict';
// Windows x64 Steamworks ABI, from the versioned Valve headers. Use the running
// client's IPC connection, never SteamAPI_Init with another game's app ID.
const path=require('node:path');
const {SteamLocalChat}=require('./steam-local-chat');
class SteamLocal {
 constructor(directory){
  if(process.platform!=='win32'||process.arch!=='x64')throw Error('Local Steam invitations currently require Windows x64.');
  const koffi=require('koffi');this.koffi=koffi;
  const library=koffi.load(path.join(directory,'steamclient64.dll'));
  const client=library.func('void *CreateInterface(const char *, int *)')('SteamClient023',null);
  if(!client)throw Error('This Steam client interface is unavailable.');
  let sequence=0;
  const bind=(object,index,result,args)=>{
   if(!object)throw Error('Steam interface is unavailable.');
   const table=koffi.decode(object,'void *'),fn=koffi.decode(table,index*8,'void *');
   const type=koffi.proto('NexusLocalSteam'+(++SteamLocal.sequence)+'_'+(++sequence),result,['void *',...args]);
   return (...values)=>koffi.call(fn,type,object,...values);
  };
  this.release=library.func('bool Steam_BReleaseSteamPipe(int)');
  this.releaseUser=library.func('void Steam_ReleaseUser(int, int)');
  this.pipe=library.func('int Steam_CreateSteamPipe()')();
  try{
   this.user=library.func('int Steam_ConnectToGlobalUser(int)')(this.pipe);
   if(!this.pipe||!this.user)throw Error('Open Steam and sign in first.');
   const user=bind(client,5,'void *',['int','int','str'])(this.user,this.pipe,'SteamUser023');
   const friends=bind(client,8,'void *',['int','int','str'])(this.user,this.pipe,'SteamFriends018');
   // CSteamID is an 8-byte C++ return value using a hidden return buffer on MSVC.
   const own=bind(user,2,'void *',['void *']);
   this.owner=()=>{const output=Buffer.alloc(8);own(output);return output.readBigUInt64LE().toString();};
   this.name=bind(friends,0,'str',[]);this.count=bind(friends,2,'int',['int']);
   this.friendByIndex=bind(friends,3,'void *',['void *','int','int']);
   this.friendName=bind(friends,6,'str',['uint64']);
   this.relationship=bind(friends,4,'int',['uint64']);
   this.game=bind(friends,7,'bool',['uint64','void *']);
   this.friendState=bind(friends,5,'int',['uint64']);
   this.requestRich=bind(friends,46,'void',['uint64']);
   this.mediumAvatar=bind(friends,34,'int',['uint64']);this.avatarHandles=new Map();
   const utils=bind(client,9,'void *',['int','str'])(this.pipe,'SteamUtils010');
   this.imageSize=bind(utils,5,'bool',['int','void *','void *']);this.imageRGBA=bind(utils,6,'bool',['int','void *','int']);
   const matchmaking=bind(client,10,'void *',['int','int','str'])(this.user,this.pipe,'SteamMatchMaking009');
   this.inviteLobby=bind(matchmaking,16,'bool',['uint64','uint64']);
   const listen=bind(friends,62,'bool',['bool']),send=bind(friends,63,'bool',['uint64','str']),read=bind(friends,64,'int',['uint64','int','void *','int','void *']);
   const Callback=koffi.struct({user:'int',callback:'int',data:'void *',size:'int'});
   // Third argument is an output buffer for legacy client exports; current x64
   // exports ignore it. Never dispatch callbacks from another client's pipe.
   const next=library.func('Steam_BGetCallback','bool',['int',koffi.out(koffi.pointer(Callback)),'void *']),free=library.func('void Steam_FreeLastCallback(int)');
   this.chatDiagnostic={callbacks:{},users:{},chatCallbacks:0,readTypes:{}};
   this.chat=new SteamLocalChat({owner:()=>this.context().owner,relationship:id=>this.relationship(BigInt(id)),listen:value=>listen(value),send:(id,text)=>send(BigInt(id),text),
    poll:()=>{const events=[];for(let i=0;i<128;i++){const message={},legacy=Buffer.alloc(8);if(!next(this.pipe,message,legacy))break;try{this.chatDiagnostic.callbacks[message.callback]=(this.chatDiagnostic.callbacks[message.callback]||0)+1;this.chatDiagnostic.users[message.user]=(this.chatDiagnostic.users[message.user]||0)+1;if(message.callback===343)this.chatDiagnostic.chatCallbacks++;if(message.callback===343&&message.data&&message.size>=12&&message.size<=64&&(message.user===0||message.user===this.user)){const data=Buffer.from(koffi.decode(message.data,koffi.array('uint8_t',message.size)));events.push({id:data.readBigUInt64LE(0).toString(),messageId:data.readInt32LE(8)});}}finally{free(this.pipe);}}return events;},
    read:(id,index)=>{const data=Buffer.alloc(16384),type=Buffer.alloc(4),length=read(BigInt(id),index,data,data.length,type);this.chatDiagnostic.readTypes[type.readInt32LE()]=(this.chatDiagnostic.readTypes[type.readInt32LE()]||0)+1;return length>0&&length<=data.length?{type:type.readInt32LE(),text:data.toString('utf8',0,length).replace(/\0+$/,'')}:null;}});

  }catch(error){this.close();throw error;}
 }
 chatDiagnostics(){return {...this.chatDiagnostic,listenerEnabled:!!this.chat?.enabled,ownPipe:this.pipe,ownUser:this.user};}
 enableChat(owner){
  // Valve's SetListenForFriendsMessages always returns true. A successful call
  // does not prove delivery on an app-less desktop pipe (live receive test fails).
  // Keep this prototype opt-in until end-to-end desktop delivery is validated.
  this.chat.owner(owner);
  if(process.env.NEXUS_STEAM_CHAT_EXPERIMENTAL!=='1')return {available:false,reason:'delivery-unverified'};
  return this.chat.enable(owner);
 }
 messages(id,owner){return this.chat.messages(id,owner);}
 send(id,text,owner){return this.chat.send(id,text,owner);}
 pumpChat(){this.chat?.pump();}
 context(){
  const owner=this.owner();if(!/^7656119\d{10}$/.test(owner))throw Error('Steam is not signed in.');
  const info=Buffer.alloc(24),playing=this.game(BigInt(owner),info);
  return {owner,appId:playing?String(info.readUInt32LE(0)):null,lobby:playing?info.readBigUInt64LE(16).toString():'0'};
 }
 snapshot(){
  const context=this.context(),owner=context.owner,friends=[];if(this.avatarOwner!==owner){this.avatarHandles.clear();this.avatarOwner=owner;}
  const read=(id,name)=>{const info=Buffer.alloc(24),playing=this.game(BigInt(id),info),gameId=playing&&info.readUInt32LE(0)?String(info.readUInt32LE(0)):null,status=this.friendState(BigInt(id));
   const row={id,provider:'steam',name:name||'Steam friend',online:status!==0,gameId:status!==0?gameId:null,canMessage:false,externalChat:true};
   const handle=this.mediumAvatar(BigInt(id));row.avatarHandle=handle;
   if(handle>0&&this.avatarHandles.get(id)!==handle){const w=Buffer.alloc(4),h=Buffer.alloc(4);if(this.imageSize(handle,w,h)){const width=w.readUInt32LE(),height=h.readUInt32LE();if(width>0&&height>0&&width<=256&&height<=256){const rgba=Buffer.alloc(width*height*4);if(this.imageRGBA(handle,rgba,rgba.length)){row.avatarImage={width,height,rgba};this.avatarHandles.set(id,handle);}}}}
   return row;
  };
  for(let i=0,n=Math.min(2000,Math.max(0,this.count(4)));i<n;i++){const out=Buffer.alloc(8);this.friendByIndex(out,i,4);const id=out.readBigUInt64LE().toString();if(/^7656119\d{10}$/.test(id))friends.push(read(id,this.friendName(BigInt(id))));}
  return {owner,name:this.name(),self:read(owner,this.name()),friends};
 }
 invite(id,appId,expectedOwner){const context=this.prepareInvite(id,appId,expectedOwner);if(!this.inviteLobby(BigInt(context.lobby),BigInt(id)))throw Error('Steam did not accept the lobby invitation. Use Steam to invite this friend.');return {success:true,kind:'steam-lobby-queued',receiptConfirmed:false};}
 findFriend(name){
  const matches=[];for(let i=0,n=Math.min(5000,this.count(4));i<n;i++){
   const output=Buffer.alloc(8);this.friendByIndex(output,i,4);
   const id=output.readBigUInt64LE();if(this.friendName(id)===name)matches.push(id.toString());
  }
  if(matches.length!==1)throw Error('Choose a unique current Steam friend.');return matches[0];
 }
 prepareInvite(id,appId,expectedOwner){
  if(!/^7656119\d{10}$/.test(String(id)))throw Error('Invalid Steam friend.');
  const context=this.context();
  if(context.owner!==expectedOwner)throw Error('Steam account changed. Reopen the invitation.');
  if(context.appId!==String(appId)||context.lobby==='0')throw Error('The current game is not exposing a Steam lobby.');
  if(this.relationship(BigInt(id))!==3)throw Error('Choose a current Steam friend.');
  return {...context,id:String(id)};
 }
 queueInvite(client,id,appId,expectedOwner){
  return queueLobbyInvite(client,this.prepareInvite(id,appId,expectedOwner));
 }
 close(){this.chat?.close();if(this.pipe&&this.user)this.releaseUser(this.pipe,this.user);if(this.pipe)this.release(this.pipe);this.user=0;this.pipe=0;}
}
SteamLocal.sequence=0;
function queueLobbyInvite(client,context){
 if(client.steamID?.toString()!==context.owner)throw Error('Steam account changed. Reopen the invitation.');
 if(!/^7656119\d{10}$/.test(context.id)||!/^7656119\d{10}$/.test(context.owner)||!/^\d+$/.test(context.lobby)||BigInt(context.lobby)<=0n||BigInt(context.lobby)>18446744073709551615n||!/^\d+$/.test(context.appId)||Number(context.appId)<1||Number(context.appId)>4294967295)throw Error('Invalid Steam lobby invitation.');
 const schema=require('steam-user/protobufs/generated/_load.js');
 // No response is defined for this Valve message. Enqueueing is not receipt.
 const body=schema.CMsgClientMMSInviteToLobby.encode({app_id:Number(context.appId),steam_id_lobby:context.lobby,steam_id_user_invited:context.id}).finish();
 client._send({msg:6621,proto:{}},body);
 return {success:true,kind:'steam-lobby-queued',receiptConfirmed:false};
}
module.exports={SteamLocal,queueLobbyInvite};
