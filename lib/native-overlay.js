'use strict';
const fs=require('node:fs'),path=require('node:path');
const WIDTH=1100,HEIGHT=800;
function inputEvent(input,viewport){
 const [message,x,y,key,flags]=input,modifiers=[];if(flags&1)modifiers.push('shift');if(flags&2)modifiers.push('control');if(flags&4)modifiers.push('alt');
 const scale=Math.min(1,viewport.width/WIDTH,viewport.height/HEIGHT),px=Math.round((x-(viewport.width-WIDTH*scale)/2)/scale),py=Math.round((y-(viewport.height-HEIGHT*scale)/2)/scale);
 if(message===0x200)return {type:'mouseMove',x:px,y:py,modifiers};
 const mouse={0x201:['mouseDown','left'],0x202:['mouseUp','left'],0x204:['mouseDown','right'],0x205:['mouseUp','right'],0x207:['mouseDown','middle'],0x208:['mouseUp','middle']}[message];if(mouse)return {type:mouse[0],button:mouse[1],clickCount:1,x:px,y:py,modifiers};
 if(message===0x20a)return {type:'mouseWheel',x:px,y:py,deltaY:(key>>16),deltaX:0,modifiers,canScroll:true};
 if(message===0x102)return key>=32?{type:'char',keyCode:String.fromCharCode(key)}:null;
 const code=key>=65&&key<=90?String.fromCharCode(key):key>=48&&key<=57?String.fromCharCode(key):({8:'Backspace',9:'Tab',13:'Enter',16:'Shift',17:'Control',18:'Alt',27:'Escape',32:'Space',33:'PageUp',34:'PageDown',35:'End',36:'Home',37:'Left',38:'Up',39:'Right',40:'Down',46:'Delete'})[key];
 return code&&[0x100,0x101,0x104,0x105].includes(message)?{type:message===0x100||message===0x104?'keyDown':'keyUp',keyCode:code,modifiers}:null;
}
class NativeOverlay{
 constructor({BrowserWindow,resources,preload,url,getTarget,onChange=()=>{},onError=()=>{},mainWindow}){Object.assign(this,{BrowserWindow,resources,preload,url,getTarget,onChange,onError,mainWindow});this.window=null;this.target=null;this.active=false;this.error=null;this.ticks=0;this.loading=false;this.loaded=false;this.closed=false;}
 available(){return process.platform==='win32'&&process.arch==='x64'&&fs.existsSync(path.join(this.resources,'NexusOverlay.dll'));}
 public(){return {native:true,overlay:this.active,overlayGame:this.target?.game||null,nativeAttached:!!this.target,nativeStatus:this.error||(!this.target?'Ready to attach to your running game':this.loaded?'Attached to game':'Attaching to game'),nativeReady:this.loaded};}
 load(){if(this.api)return;const k=require('koffi');this.library=k.load(path.join(this.resources,'NexusOverlay.dll'));const bind=declaration=>this.library.func(declaration);this.api={create:bind('int NO_Create(uint32_t,uint32_t,uint32_t)'),attach:bind('int NO_Attach(uint32_t,str16,str16)'),frame:bind('int NO_Frame(void *,uint32_t)'),heartbeat:bind('void NO_Heartbeat()'),status:bind('int NO_Status(int)'),active:bind('void NO_Active(int)'),input:bind('int NO_Input(void *)'),stop:bind('void NO_Stop()')};}
 async surface(){if(this.window&&!this.window.isDestroyed())return;this.window=new this.BrowserWindow({show:false,width:WIDTH,height:HEIGHT,frame:false,transparent:true,skipTaskbar:true,webPreferences:{preload:this.preload,offscreen:true,contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false,additionalArguments:['--nexus-native-surface']}});
  this.window.setMenu(null);this.window.webContents.setWindowOpenHandler(()=>({action:'deny'}));this.window.webContents.on('will-navigate',event=>event.preventDefault());this.window.webContents.setFrameRate(30);
  this.window.webContents.on('paint',(_event,_dirty,image)=>{if(this.target&&this.api&&!this.closed){const pixels=image.getBitmap();if(pixels.length===WIDTH*HEIGHT*4){this.api.frame(pixels,pixels.length);if(this.pendingOpen){this.pendingOpen=false;this.api.active(1);}}}});
  await this.window.loadURL(this.url);this.sendState();
 }
 trusts(event){return this.window&&!this.window.isDestroyed()&&event.sender===this.window.webContents&&event.senderFrame===this.window.webContents.mainFrame;}
 send(channel,...args){if(this.window&&!this.window.isDestroyed())this.window.webContents.send(channel,...args);}
 sendState(){this.send('window:changed',this.public());this.onChange(this.public());}
 async toggle(){if(this.loading)return this.public();if(this.target){this.api.active(this.active?0:1);this.active=!this.active;this.sendState();return this.public();}
  this.loading=true;this.error=null;try{if(!this.available())throw Error('The native overlay is unavailable in this build.');const target=await this.getTarget();if(!target||!Number.isInteger(target.pid)||target.pid<1||!path.isAbsolute(target.path))throw Error('Start an installed game before opening the Nexus overlay.');this.load();if(!this.api.create(target.pid,WIDTH,HEIGHT))throw Error('A native overlay connection already exists or is unavailable.');this.target=target;this.active=true;this.loaded=false;this.pendingOpen=true;await this.surface();this.sendState();this.timer=setInterval(()=>this.poll(),16);this.timer.unref();
   const attached=await new Promise((resolve,reject)=>this.api.attach.async(target.pid,path.join(this.resources,'NexusOverlay.dll'),target.path,(error,result)=>error?reject(error):resolve(result)));if(!attached)throw Error('The game did not accept the overlay. Nexus will not bypass game protections.');this.sendState();
  }catch(error){this.api?.stop();clearInterval(this.timer);this.target=null;this.active=false;this.error=error.message;this.onError(error.message);this.sendState();}finally{this.loading=false;}return this.public();
 }
 hotkey(){// Once attached, the in-game native hook reads Alt+C itself.
  if(!this.target)return this.toggle();return this.public();
 }
 poll(){if(!this.target||!this.api)return;this.api.heartbeat();if(++this.ticks%60===0&&!this.api.status(7)){this.api.stop();this.target=null;this.active=false;this.loaded=false;clearInterval(this.timer);this.sendState();return;}const active=this.pendingOpen||!!this.api.status(1),ready=!!this.api.status(0),error=this.api.status(2);if(active!==this.active||ready!==this.loaded){this.active=active;this.loaded=ready;this.sendState();}if(error&&error!==this.lastError){this.lastError=error;this.error='Native overlay renderer error '+error+'. Close the overlay and retry after restarting the game.';this.onError(this.error);}
  const buffer=Buffer.alloc(20),viewport={width:this.api.status(3)||WIDTH,height:this.api.status(4)||HEIGHT};for(let i=0;i<256&&this.api.input(buffer);i++){const row=[buffer.readUInt32LE(0),buffer.readInt32LE(4),buffer.readInt32LE(8),buffer.readUInt32LE(12),buffer.readUInt32LE(16)],event=inputEvent(row,viewport);if(event&&this.window&&!this.window.isDestroyed())try{this.window.webContents.sendInputEvent(event);}catch{}}
 }
 hide(){if(this.api)this.api.active(0);this.active=false;this.sendState();}
 showMain(){this.hide();this.mainWindow.show();this.mainWindow.focus();}
 close(){this.closed=true;clearInterval(this.timer);this.api?.stop();this.target=null;this.active=false;this.window?.destroy();this.window=null;}
}
module.exports={NativeOverlay,inputEvent,WIDTH,HEIGHT};
