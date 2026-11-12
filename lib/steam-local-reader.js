'use strict';
const path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
class SteamLocalReader{
 constructor({utilityProcess,directory}){Object.assign(this,{utilityProcess,directory});this.pending=new Map();this.sequence=0;this.generation=0;}
 async start(){
  if(this.ready)return this.ready;
  const generation=this.generation;this.ready=(async()=>{
   const directory=this.directory();if(!directory)throw Error('Steam installation not found.');
   const file=path.join(directory,'steamclient64.dll');
   const command="$s=Get-AuthenticodeSignature -LiteralPath $env:NEXUS_STEAM_DLL; if($s.Status -eq 'Valid' -and $s.SignerCertificate.Subject -match '(^|, )O=Valve Corp\\.(,|$)'){[Console]::Write('valid')}else{exit 1}";
   const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0');
   try{await promisify(execFile)(path.join(powershell,'powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000,maxBuffer:4096,env:{...process.env,PSModulePath:path.join(powershell,'Modules'),NEXUS_STEAM_DLL:file}});}catch{throw Error('The installed Steam library could not be verified.');}
   if(generation!==this.generation)throw Error('Local Steam connection closed.');
   const child=this.utilityProcess.fork(path.join(__dirname,'steam-local-worker.js'),[],{serviceName:'The Nexus local Steam',stdio:'pipe'});this.child=child;child.stdout?.resume();child.stderr?.resume();
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Local Steam did not start.')),10000);timer.unref();
    child.on('message',data=>{if(data.type==='ready'){clearTimeout(timer);resolve();return;}const pending=this.pending.get(data.id);if(pending){this.pending.delete(data.id);clearTimeout(pending.timer);data.error?pending.reject(Error(data.error)):pending.resolve(data.result);}else if(data.id===undefined&&data.error){clearTimeout(timer);reject(Error(data.error));}});
    child.once('exit',()=>{clearTimeout(timer);if(this.child!==child)return;this.child=null;this.ready=null;for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Local Steam connection stopped.'));}this.pending.clear();reject(Error('Local Steam connection stopped.'));});
    child.postMessage({type:'init',directory});
   });
  })().catch(error=>{this.child?.kill();this.child=null;this.ready=null;throw error;});
  return this.ready;
 }
 async call(method,...args){await this.start();const id=++this.sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Local Steam request timed out.'));},8000);timer.unref();this.pending.set(id,{resolve,reject,timer});this.child.postMessage({id,method,args});});}
 enableChat(owner){return this.call('enableChat',owner);}
 messages(...args){return this.call('messages',...args);}
 send(...args){return this.call('send',...args);}
 snapshot(){return this.call('snapshot');}
 invite(...args){return this.call('invite',...args);}
 context(){return this.call('context');}
 prepareInvite(...args){return this.call('prepareInvite',...args);}
 close(){this.generation++;const child=this.child;if(child){try{child.postMessage({type:'shutdown'});}catch{}const timer=setTimeout(()=>{try{child.kill();}catch{}},500);timer.unref();}this.child=null;this.ready=null;for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Local Steam connection closed.'));}this.pending.clear();}
}
module.exports={SteamLocalReader};
