'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
function runningGameMatch(games,processes,{platform=process.platform,foregroundPid=0,history={}}={}){
 const paths=platform==='win32'?path.win32:path.posix,normalize=value=>{if(typeof value!=='string'||!paths.isAbsolute(value))return '';const full=paths.normalize(value);return platform==='win32'?full.toLowerCase():full;};
 const matches=[];
 for(const game of games.filter(game=>game.installed&&!game.web)){
  const root=normalize(game.installLocation),target=game.launchTarget||{},exact=[target.exe,game.executablePath,game.executable&&game.installLocation?paths.join(game.installLocation,game.executable):game.executable].map(normalize).filter(Boolean);
  for(const process of processes){const exe=normalize(process.path);if(!exe||/(?:crashhandler|crashreport|unins\d*|updater|launcher|bootstrap|anti.?cheat)/i.test(paths.basename(exe)))continue;const inside=root&&root!==paths.parse(root).root&&exe.startsWith(root.endsWith(paths.sep)?root:root+paths.sep);if(exact.includes(exe)||inside)matches.push({game,pid:process.pid,path:process.path,root:root.length});}
 }
 matches.sort((a,b)=>Number(b.pid===foregroundPid)-Number(a.pid===foregroundPid)||b.root-a.root||Date.parse(history[b.game.key]?.lastLaunched||0)-Date.parse(history[a.game.key]?.lastLaunched||0));return matches[0]||null;
}
function runningGame(games,processes,options){return runningGameMatch(games,processes,options)?.game||null;}
function invitationChoices(games,currentKey){const installed=games.filter(game=>game.installed&&!game.web);const current=installed.find(game=>game.key===currentKey);return current?[current]:installed;}
class RunningGames{
 constructor(){this.lastPid=0;this.cache=null;if(process.platform==='win32'){try{const lib=require('koffi').load('user32.dll');this.window=lib.func('uintptr_t __stdcall GetForegroundWindow()');this.pid=lib.func('uint32_t __stdcall GetWindowThreadProcessId(uintptr_t window, _Out_ uint32_t *processId)');const kernel=require('koffi').load('kernel32.dll');this.openProcess=kernel.func('void * __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)');this.processPath=kernel.func('int __stdcall QueryFullProcessImageNameW(void * process, uint32_t flags, _Out_ uint16_t *buffer, _Inout_ uint32_t *size)');this.closeHandle=kernel.func('int __stdcall CloseHandle(void * handle)');this.timer=setInterval(()=>{try{const output=[0];this.pid(this.window(),output);if(output[0]&&output[0]!==process.pid)this.lastPid=output[0];}catch{}},1000);this.timer.unref();}catch{}}}
 async processes(){
  if(this.cache&&Date.now()-this.cache.at<2000)return this.cache.rows;
  let rows=[];
  if(process.platform==='win32'){rows=await new Promise(resolve=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object Id,Path) | ConvertTo-Json -Compress"],{windowsHide:true,timeout:6000,maxBuffer:2e6},(error,stdout)=>{try{const data=JSON.parse(stdout);resolve((Array.isArray(data)?data:[data]).filter(Boolean).map(row=>({pid:row.Id,path:row.Path})));}catch{resolve([]);}}));}
  else if(process.platform==='linux'){try{for(const id of fs.readdirSync('/proc').filter(id=>/^\d+$/.test(id))){try{rows.push({pid:Number(id),path:fs.readlinkSync('/proc/'+id+'/exe')});}catch{}}}catch{}}
  if(this.openProcess){for(const row of rows.filter(row=>!row.path&&row.pid)){let handle;try{handle=this.openProcess(0x1000,0,row.pid);if(handle){const buffer=Buffer.alloc(65536),size=[32768];if(this.processPath(handle,0,buffer,size))row.path=buffer.toString('utf16le',0,size[0]*2);}}catch{}finally{if(handle)this.closeHandle(handle);}}}
  this.cache={at:Date.now(),rows};return rows;
 }
 async target(games,history){return runningGameMatch(games,await this.processes(),{foregroundPid:this.lastPid,history});}
 async current(games,history){return runningGame(games,await this.processes(),{foregroundPid:this.lastPid,history});}
 close(){clearInterval(this.timer);}
}
module.exports={RunningGames,runningGame,runningGameMatch,invitationChoices};
