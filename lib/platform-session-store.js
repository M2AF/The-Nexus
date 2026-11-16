'use strict';
const fs=require('node:fs'),path=require('node:path');
class PlatformSessionStore{
 constructor(directory,safeStorage){this.file=path.join(directory,'platform-sessions.enc');this.safeStorage=safeStorage;}
 get available(){return this.safeStorage.isEncryptionAvailable()&&this.safeStorage.getSelectedStorageBackend?.()!=='basic_text';}
 read(){if(!this.available)return {};try{if(fs.statSync(this.file).size>1000000)return {};const data=JSON.parse(this.safeStorage.decryptString(fs.readFileSync(this.file)));return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch{return {};}}
 get(provider){return this.read()[provider]||null;}
 set(provider,value){if(!['steam','discord','xbox','epic'].includes(provider)||!this.available)return false;try{const data=this.read();if(value===null)delete data[provider];else data[provider]=value;fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',this.safeStorage.encryptString(JSON.stringify(data)));fs.renameSync(this.file+'.tmp',this.file);return true;}catch{return false;}}
}
module.exports={PlatformSessionStore};
