'use strict';
// Detects whether a game is protected by an anti-cheat system, so the native
// in-game overlay can REFUSE to attach. Our overlay injects a DLL and hooks the
// game's graphics/input; anti-cheat engines flag that behavior (they cannot tell
// a friends overlay from a cheat), which can get a player banned. When any known
// anti-cheat is detected we do not inject — the user keeps the floating overlay.
//
// Erring toward refusing is intentional: a false "protected" only costs the native
// overlay for that game, while a false "safe" risks the user's account.
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');

// Known anti-cheat process image names (lowercase). Matched as substrings of a
// process listing, so partial driver/service names are fine.
const PROCESSES=['beservice.exe','bedaisy.exe','easyanticheat.exe','easyanticheat_eos.exe','easyanticheat_x64.exe','start_protected_game.exe','vgc.exe','vgtray.exe','vgk.sys','gameguard.des','gepard.sys','blackcipher.aes','blackcall.aes','pbsvc.exe','pnkbstra.exe','pnkbstrb.exe','xhunter1.sys','anticheatexpert','mhyprot','ricochet'];

// File/folder names that sit beside a protected game's executable (lowercase).
const MARKERS=['easyanticheat','easyanticheat_eos','battleye','beclient_x64.dll','beclient_x86.dll','beservice.exe','gameguard','xigncode','xigncode3','vanguard','punkbuster','pnkbstra.exe','anticheatexpert','mhyprot2.sys'];

function nameHits(name){const lower=String(name||'').toLowerCase();return MARKERS.some(m=>lower===m||lower.includes(m));}

// Scan the game's folder (and one level of subfolders) for anti-cheat markers.
function scanMarkers(dir,readdir,depth=1){
 let entries;try{entries=readdir(dir);}catch{return null;}
 if(!Array.isArray(entries))return null;
 for(const entry of entries){if(nameHits(entry&&entry.name))return String(entry.name).toLowerCase();}
 if(depth>0)for(const entry of entries){if(entry&&typeof entry.isDirectory==='function'&&entry.isDirectory()){const hit=scanMarkers(path.join(dir,entry.name),readdir,depth-1);if(hit)return hit;}}
 return null;
}

function defaultReaddir(dir){try{return fs.readdirSync(dir,{withFileTypes:true});}catch{return[];}}
function defaultListProcesses(){return new Promise(resolve=>{try{execFile('tasklist',['/fo','csv','/nh'],{windowsHide:true,timeout:4000},(error,stdout)=>resolve(error?'':String(stdout).toLowerCase()));}catch{resolve('');}});}

// Returns {protected:boolean, reason:string|null, source:'files'|'process'|null}.
async function detectAntiCheat(target,deps={}){
 const readdir=deps.readdir||defaultReaddir,listProcesses=deps.listProcesses||defaultListProcesses;
 if(target&&typeof target.path==='string'&&target.path){const hit=scanMarkers(path.dirname(target.path),readdir);if(hit)return {protected:true,reason:hit,source:'files'};}
 let listing='';try{listing=String(await listProcesses()||'').toLowerCase();}catch{listing='';}
 if(listing){const proc=PROCESSES.find(name=>listing.includes(name));if(proc)return {protected:true,reason:proc,source:'process'};}
 return {protected:false,reason:null,source:null};
}

module.exports={detectAntiCheat,scanMarkers,PROCESSES,MARKERS};
