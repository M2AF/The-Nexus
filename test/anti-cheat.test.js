'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {detectAntiCheat,scanMarkers}=require('../lib/anti-cheat');

const dirent=(name,dir=false)=>({name,isDirectory:()=>dir});
const noProcesses=async()=>'';

test('Refuses a game with an anti-cheat folder beside its executable, before any process scan',async()=>{
 let processScanned=false;
 const readdir=d=>d.replace(/\\/g,'/').endsWith('/game')?[dirent('Game.exe'),dirent('EasyAntiCheat',true)]:[];
 const r=await detectAntiCheat({path:'C:/games/game/Game.exe',game:{name:'Game'}},{readdir,listProcesses:async()=>{processScanned=true;return '';}});
 assert.equal(r.protected,true);assert.equal(r.source,'files');assert.match(r.reason,/easyanticheat/);assert.equal(processScanned,false,'folder match short-circuits the process scan');
});

test('Refuses when a known anti-cheat service is running, even with a clean game folder',async()=>{
 const readdir=()=>[dirent('Game.exe'),dirent('data',true)];
 const r=await detectAntiCheat({path:'C:/games/clean/Game.exe'},{readdir,listProcesses:async()=>'"BEService.exe","1234","Services","0","5,000 K"'});
 assert.equal(r.protected,true);assert.equal(r.source,'process');assert.equal(r.reason,'beservice.exe');
});

test('Allows a clean game with no markers and no anti-cheat processes running',async()=>{
 const readdir=()=>[dirent('Game.exe'),dirent('assets',true)];
 const r=await detectAntiCheat({path:'C:/games/solo/Game.exe'},{readdir,listProcesses:async()=>'"explorer.exe","42","Console","1","90,000 K"'});
 assert.equal(r.protected,false);assert.equal(r.reason,null);assert.equal(r.source,null);
});

test('Finds anti-cheat markers one subfolder deep',()=>{
 const readdir=d=>{const p=d.replace(/\\/g,'/');if(p.endsWith('/game'))return [dirent('bin',true)];if(p.endsWith('/bin'))return [dirent('run.exe'),dirent('BattlEye',true)];return [];};
 assert.equal(scanMarkers('C:/g/game',readdir),'battleye');
});

test('A missing or unreadable game folder does not crash and is treated as no marker',async()=>{
 const readdir=()=>{throw Error('ENOENT');};
 const r=await detectAntiCheat({path:'C:/nope/Game.exe'},{readdir,listProcesses:noProcesses});
 assert.equal(r.protected,false);
});
