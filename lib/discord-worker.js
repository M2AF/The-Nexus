'use strict';
const {DiscordNative}=require('./discord-native');let client;
process.parentPort.on('message',async event=>{const message=event.data;
 try{
  if(message.type==='init'){if(client)throw Error('Already initialized');client=new DiscordNative({file:message.file,applicationId:message.applicationId,onChange:state=>process.parentPort.postMessage({type:'state',state}),onToken:token=>process.parentPort.postMessage({type:'token',token})});if(message.token){try{await client.restore(message.token);}catch{client.status='error';client.active=false;}}process.parentPort.postMessage({type:'ready',state:client.public()});return;}
  if(!client||!['connect','disconnect','messages','send','public'].includes(message.method))throw Error('Unsupported Discord operation.');
  const result=await client[message.method](...(message.args||[]));process.parentPort.postMessage({type:'result',id:message.id,result});
 }catch{process.parentPort.postMessage({type:'result',id:message.id,error:'Discord could not complete the request. Check the connection and Social SDK access, then retry.'});}
});
