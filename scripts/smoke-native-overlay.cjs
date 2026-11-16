'use strict';
// Isolated graphics fixture only. This script never targets a user's game.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),k=require('koffi');
const dir=path.resolve(__dirname,'../output/native-overlay-build/Release'),file=path.join(dir,'NexusOverlay.dll');
const native=k.load(file),create=native.func('int NO_Create(uint32_t,uint32_t,uint32_t)'),attach=native.func('int NO_Attach(uint32_t,str16,str16)'),frame=native.func('int NO_Frame(void *,uint32_t)'),heartbeat=native.func('void NO_Heartbeat()'),status=native.func('int NO_Status(int)'),active=native.func('void NO_Active(int)'),stop=native.func('void NO_Stop()');
let timer,game,rows=[],inputCount=0;const input=native.func('int NO_Input(void *)');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){for(let i=0;i<200;i++){if(check())return;await sleep(50);}throw Error('Timed out: '+label);}
(async()=>{
 game=spawn(path.join(dir,'NexusOverlayTest.exe'),['--hidden'],{windowsHide:true,stdio:['ignore','pipe','pipe']});let pending='';game.stdout.on('data',data=>{pending+=data;const lines=pending.split('\n');pending=lines.pop();for(const line of lines){try{rows.push(JSON.parse(line));}catch{}}});game.stderr.on('data',data=>process.stderr.write(data));
 await until(()=>rows.some(r=>r.ready),'D3D12 fixture ready');assert.equal(rows.find(r=>r.ready).pid,game.pid);assert(create(game.pid,1100,800));
 const pixels=Buffer.alloc(1100*800*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=220;pixels[i+1]=10;pixels[i+2]=240;pixels[i+3]=255;}assert(frame(pixels,pixels.length));active(1);
 timer=setInterval(()=>{heartbeat();const data=Buffer.alloc(20);while(input(data))inputCount++;},50);
 assert(attach(game.pid,file,path.join(dir,'NexusOverlayTest.exe')),'Attach only to our spawned fixture');await until(()=>status(0)===1,'hooks installed');await until(()=>rows.some(r=>r.overlaySeen),'actual GPU readback shows overlay');await until(()=>inputCount>0,'game input routed into overlay');
 const baseline=rows.filter(r=>r.frames).at(-1)?.keys||1;active(0);await until(()=>rows.some(r=>r.frames&&r.overlayVisible===false&&r.keys>baseline),'input and unobscured rendering resume');
 active(1);await until(()=>rows.filter(r=>r.frames).at(-1)?.overlayVisible===true,'overlay renders again');stop();await until(()=>rows.filter(r=>r.frames).at(-1)?.overlayVisible===false,'stop releases overlay');
 assert(create(game.pid,1100,800),'Reconnect after host stop without restarting target');assert(frame(pixels,pixels.length));active(1);assert(attach(game.pid,file,path.join(dir,'NexusOverlayTest.exe')));await until(()=>rows.filter(r=>r.frames).at(-1)?.overlayVisible===true,'reattached overlay renders');stop();const result={reconnect:true,api:'D3D12',hooksReady:true,gpuReadback:true,inputCaptured:inputCount>0,inputReleased:true,stopPassThrough:true};fs.mkdirSync(path.resolve(__dirname,'../output/native-overlay'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../output/native-overlay/graphics-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{clearInterval(timer);stop();game?.kill();});
