'use strict';
const validId=value=>/^7656119\d{10}$/.test(String(value));
class SteamLocalChat{
 constructor(transport){this.transport=transport;this.history=new Map();this.seen=new Set();this.sequence=0;this.enabled=false;}
 owner(expected){const owner=this.transport.owner();if(!validId(owner)||expected&&owner!==expected){this.close();throw Error('Steam account changed. Reconnect Steam in Nexus.');}return owner;}
 enable(expected){const owner=this.owner(expected);if(this.accountId!==owner){this.close();this.accountId=owner;}if(!this.enabled){if(!this.transport.listen(true))throw Error('Steam desktop chat is unavailable.');this.enabled=true;}return {available:true,accountId:owner};}
 friend(id,expected){this.owner(expected);id=String(id);if(!validId(id)||this.transport.relationship(id)!==3)throw Error('Choose a current Steam friend.');return id;}
 append(id,message){const rows=this.history.get(id)||[];rows.push(message);this.history.delete(id);this.history.set(id,rows.slice(-50));while(this.history.size>50)this.history.delete(this.history.keys().next().value);}
 pump(){if(!this.enabled)return;this.owner(this.accountId);for(const event of this.transport.poll()){const id=String(event.id),key=id+':'+event.messageId;if(!validId(id)||!Number.isInteger(event.messageId)||event.messageId<0||this.seen.has(key)||this.transport.relationship(id)!==3)continue;this.seen.add(key);if(this.seen.size>4096)this.seen.delete(this.seen.values().next().value);const entry=this.transport.read(id,event.messageId);if(entry?.type===1&&typeof entry.text==='string'&&entry.text.length<=10000)this.append(id,{id:'incoming:'+key,sender:id,text:entry.text,at:Date.now()});}}
 messages(id,expected){id=this.friend(id,expected);this.enable(expected);this.pump();return {messages:[...(this.history.get(id)||[])],historyScope:'nexus-session'};}
 send(id,text,expected){id=this.friend(id,expected);if(typeof text!=='string'||!text.trim()||text.length>2000||text.includes('\0'))throw Error('Write a message up to 2,000 characters.');this.enable(expected);this.pump();if(!this.transport.send(id,text))throw Error('Steam did not accept the message. Check Steam chat restrictions or rate limits.');this.append(id,{id:'outgoing:'+(++this.sequence),sender:this.accountId,text,at:Date.now()});return {success:true,kind:'steam-desktop-message',receiptConfirmed:false};}
 close(){if(this.enabled){try{this.transport.listen(false);}catch{}}this.enabled=false;this.accountId=null;this.history.clear();this.seen.clear();}
}
module.exports={SteamLocalChat};
