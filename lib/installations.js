'use strict';
const fs=require('node:fs'),path=require('node:path');
const PROVIDERS={steam:'Steam',gog:'GOG',epic:'Epic Games',xbox:'Xbox',itch:'itch.io',battlenet:'Battle.net'};
const ACTIVE=new Set(['requested','waiting','downloading','paused','verifying','update-required']);
function numeric(value){const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;}
function steamState(text,exists=fs.existsSync,folder=''){
 const field=name=>(text.match(new RegExp('"'+name+'"\\s+"([^"\\r\\n]*)"','i'))||[])[1];
 const flags=numeric(field('StateFlags')),id=field('appid');if(flags===null||!/^\d+$/.test(id||''))return null;
 const total=numeric(field('BytesToDownload')),downloaded=numeric(field('BytesDownloaded')),stageTotal=numeric(field('BytesToStage')),staged=numeric(field('BytesStaged'));
 const directory=field('installdir');const safeDirectory=directory&&!/[\\/]/.test(directory)&&directory!=='.'&&directory!=='..';
 let status=flags&512?'paused':flags&(256|131072|262144)?'verifying':flags&(1024|524288|1048576)?'downloading':flags&2?'update-required':'waiting';
 const complete=!!(flags&4)&&!(flags&(2|256|512|1024|131072|262144|524288|1048576))&&(!total||downloaded!==null&&downloaded>=total)&&safeDirectory&&exists(path.join(folder,'common',directory));
 if(complete)status='installed';
 return {id,status,downloaded:downloaded??null,total:total>0?total:null,staged,stageTotal:stageTotal>0?stageTotal:null,progress:status==='installed'?100:status==='verifying'&&stageTotal>0&&staged!==null?Math.min(100,staged/stageTotal*100):total>0&&downloaded!==null?Math.min(100,downloaded/total*100):null,observable:true};
}
function readSteamState(id,folders){if(!/^\d+$/.test(String(id)))throw Error('Invalid Steam game ID.');for(const folder of folders){const file=path.join(folder,`appmanifest_${id}.acf`);try{if(fs.statSync(file).size>1024*1024)continue;const result=steamState(fs.readFileSync(file,'utf8'),fs.existsSync,folder);if(result?.id===String(id))return result;}catch{}}return null;}
function gameIdentity(game){const provider=game?.provider,id=String(game?.catalogId||game?.id||'');if(!Object.hasOwn(PROVIDERS,provider)||!id||id.length>200||/[\x00-\x1f]/.test(id))throw Error('This game has no supported installation provider.');if(['steam','gog','itch'].includes(provider)&&!/^\d+$/.test(id))throw Error('Invalid platform game ID.');if(provider==='battlenet'&&!require('./battlenet').product(id))throw Error('Invalid Battle.net product ID.');return {provider,id};}
class Installations{
 constructor({directory,openClient,steamFolders=()=>[],library=()=>[],onChange=()=>{},onInstalled=async()=>{},now=()=>Date.now()}){Object.assign(this,{directory,openClient,steamFolders,library,onChange,onInstalled,now});this.jobs=[];this.samples=new Map();this.pending=new Set();this.polling=false;this.folders=[];this.foldersAt=-Infinity;this.file=path.join(directory,'installations.json');try{const rows=JSON.parse(fs.readFileSync(this.file,'utf8'));if(Array.isArray(rows))for(const row of rows.slice(0,100)){try{const identity=gameIdentity(row);if(typeof row.name!=='string'||row.name.length>500||!['installed','error','removed',...ACTIVE].includes(row.status))continue;this.jobs.push({...identity,key:identity.provider+':'+identity.id,name:row.name,status:ACTIVE.has(row.status)?'waiting':row.status,requestedAt:Number(row.requestedAt)||0,updatedAt:Number(row.updatedAt)||0,progress:null,total:null,downloaded:null,observable:false,error:row.error?String(row.error).slice(0,200):null});}catch{}}}catch{}}
 snapshot(){return {jobs:this.jobs.map(job=>({...job})),active:this.jobs.filter(job=>ACTIVE.has(job.status)).length};}
 save(){fs.mkdirSync(this.directory,{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.jobs,null,2));fs.renameSync(this.file+'.tmp',this.file);this.onChange(this.snapshot());}
 async request(game){if(!game?.owned||game.installed||game.web)throw Error('Choose an owned game that is not installed.');const {provider,id}=gameIdentity(game),key=provider+':'+id;if(this.pending.has(key))return this.snapshot();const previous=this.jobs.find(job=>job.key===key);if(previous&&ACTIVE.has(previous.status))return this.snapshot();this.pending.add(key);try{await this.openClient(game);const job={provider,id,key,name:String(game.name).slice(0,500),status:'waiting',requestedAt:this.now(),updatedAt:this.now(),progress:null,total:null,downloaded:null,speed:null,eta:null,observable:false,error:null};this.jobs=this.jobs.filter(row=>row.key!==key);this.jobs.unshift(job);this.jobs=this.jobs.slice(0,100);this.save();await this.poll();return this.snapshot();}finally{this.pending.delete(key);}}
 async reopen(key,resolve){const job=this.jobs.find(job=>job.key===key);if(!job)throw Error('Download is no longer in the list.');const game=resolve(job);if(!game)throw Error('This title is no longer in the owned library.');await this.openClient(game);return this.snapshot();}
 remove(key){if(!this.jobs.some(job=>job.key===key))throw Error('Download is no longer in the list.');this.jobs=this.jobs.filter(job=>job.key!==key);this.samples.delete(key);this.save();return this.snapshot();}
 async poll(){if(this.polling)return this.snapshot();this.polling=true;try{const now=this.now(),library=this.library(),completed=[];let changed=false;if(this.jobs.some(job=>job.provider==='steam'&&ACTIVE.has(job.status))&&now-this.foldersAt>60000){this.folders=this.steamFolders();this.foldersAt=now;}
  for(const job of this.jobs.filter(row=>ACTIVE.has(row.status))){let observation=job.provider==='steam'?readSteamState(job.id,this.folders):null;
   if(!observation){const installed=library.find(game=>game.provider===job.provider&&String(game.catalogId||game.id)===job.id&&game.installed);observation=installed?{status:'installed',progress:100,observable:false}:{status:'waiting',progress:null,observable:false,downloaded:null,total:null};}
   const previous=this.samples.get(job.key);let speed=null;if(observation.status==='downloading'&&observation.downloaded!==null&&previous&&now>previous.time&&observation.downloaded>=previous.bytes)speed=(observation.downloaded-previous.bytes)/((now-previous.time)/1000);
   if(observation.downloaded!==null&&observation.downloaded!==undefined)this.samples.set(job.key,{bytes:observation.downloaded,time:now});
   const next={...observation,speed,eta:speed>0&&observation.total!==null?Math.max(0,(observation.total-observation.downloaded)/speed):null};delete next.id;
   if(Object.keys(next).some(key=>job[key]!==next[key])){Object.assign(job,next,{updatedAt:now});changed=true;if(job.status==='installed')completed.push(job);}
  }if(changed)this.save();if(completed.length)await this.onInstalled(completed);return this.snapshot();
 }finally{this.polling=false;}}
 start(){this.timer=setInterval(()=>this.poll().catch(()=>{}),3000);this.timer.unref();this.poll().catch(()=>{});}
 close(){clearInterval(this.timer);}
}
module.exports={Installations,steamState,readSteamState,gameIdentity,ACTIVE};
