'use strict';
const path=require('node:path');
class DiscordConnector{
 constructor({utilityProcess,store,resources,applicationId='1477897985630273597',onChange=()=>{}}){Object.assign(this,{utilityProcess,store,resources,applicationId,onChange});this.state={provider:'discord',status:'disconnected',connected:false,friends:[]};this.pending=new Map();this.sequence=0;}
 public(){return {...this.state,remembered:!!this.store.get('discord'),canRemember:this.store.available};}
 async start(){if(this.child&&this.ready)return this.ready;const child=this.utilityProcess.fork(path.join(__dirname,'discord-worker.js'),[],{serviceName:'The Nexus Discord',stdio:'pipe'});this.child=child;child.stdout?.resume();if(process.env.NEXUS_TEST_DATA)child.stderr?.on('data',data=>process.stderr.write(data));else child.stderr?.resume();
  this.ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Discord SDK did not start.')),30000);timer.unref();child.on('message',data=>{
   if(data.type==='ready'){clearTimeout(timer);this.state=data.state;this.onChange(this.public());resolve();}
   if(data.type==='state'){this.state=data.state;this.onChange(this.public());}
   if(data.type==='token')this.store.set('discord',data.token);
   if(data.type==='result'){const pending=this.pending.get(data.id);if(pending){clearTimeout(pending.timer);this.pending.delete(data.id);if(data.error)pending.reject(Error(data.error));else pending.resolve(data.result);}else if(data.id===undefined){clearTimeout(timer);reject(Error(data.error||'Discord SDK unavailable.'));}}
  });child.on('exit',()=>{clearTimeout(timer);this.child=null;this.ready=null;this.state={provider:'discord',status:'unavailable',connected:false,friends:[],error:'Discord connection stopped. Reconnect to try again.'};for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Discord connection stopped.'));}this.pending.clear();this.onChange(this.public());reject(Error('Discord SDK stopped.'));});
  });
  const file=process.platform==='win32'?'discord_partner_sdk.dll':'libdiscord_partner_sdk.so';child.postMessage({type:'init',applicationId:this.applicationId,file:path.join(this.resources,'discord',process.platform+'-'+process.arch,file),token:this.store.get('discord')});return this.ready;
 }
 async call(method,...args){await this.start();const id=++this.sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Discord request timed out.'));},method==='connect'?150000:50000);timer.unref();this.pending.set(id,{resolve,reject,timer});this.child.postMessage({id,method,args});});}
 async refresh(){if(!this.child)return this.public();this.state=await this.call('public');return this.public();}
 connect(){return this.call('connect');}
 messages(id){return this.call('messages',id);}
 send(id,text){return this.call('send',id,text);}
 async disconnect(){this.store.set('discord',null);if(this.child)await this.call('disconnect');this.state={provider:'discord',status:'disconnected',connected:false,friends:[]};this.onChange(this.public());return this.public();}
 restore(){if(this.store.get('discord'))this.start().catch(()=>{});}
 close(){this.child?.kill();this.child=null;}
}
module.exports={DiscordConnector};
