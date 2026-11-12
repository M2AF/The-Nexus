'use strict';
const {SteamLocal}=require('./steam-local');let client;let timer;
process.parentPort.on('message',event=>{const message=event.data;
 try{
  if(message.type==='shutdown'){clearInterval(timer);client?.close();client=null;process.exit(0);return;}
  if(message.type==='init'){if(client)throw Error('Already initialized.');client=new SteamLocal(message.directory);timer=setInterval(()=>{try{client?.pumpChat();}catch{}},250);timer.unref();process.parentPort.postMessage({type:'ready'});return;}
  if(!client||!['context','prepareInvite','snapshot','invite','enableChat','messages','send'].includes(message.method))throw Error('Unsupported local Steam operation.');
  const result=client[message.method](...(message.args||[]));process.parentPort.postMessage({id:message.id,result});
 }catch(error){process.parentPort.postMessage({id:message.id,error:error.message});}
});
process.on('exit',()=>client?.close());
