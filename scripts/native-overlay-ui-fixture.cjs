'use strict';
// Synthetic Electron UI connected only to our own DirectX fixture.
const {app,BrowserWindow,ipcMain}=require('electron'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{spawn}=require('node:child_process');
const {NativeOverlay}=require('../lib/native-overlay'),Theme=require('../app/theme-colors');
const root=path.resolve(__dirname,'..');app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'nexus-native-ui-')));global.fixtureRows=[];global.fixtureUnexpected=[];
app.whenReady().then(async()=>{
 const target=path.join(root,'output/native-overlay-build/Release/NexusOverlayTest.exe');const game=spawn(target,['--hidden'],{windowsHide:true,stdio:['ignore','pipe','ignore']});global.fixtureGame=game;let pending='';game.stdout.on('data',data=>{pending+=data;const lines=pending.split('\n');pending=lines.pop();for(const line of lines){try{global.fixtureRows.push(JSON.parse(line));}catch{}}});
 for(let i=0;i<100&&!global.fixtureRows.some(row=>row.ready);i++)await new Promise(resolve=>setTimeout(resolve,50));
 const friends=[{provider:'discord',id:'100000000000000001',name:'Same-game fixture friend',online:true,playing:'Example game'},{provider:'discord',id:'100000000000000003',name:'Different-game fixture friend',online:true,playing:'Another game'}];
 const model={discord:{provider:'discord',connected:true,status:'connected',name:'Fixture owner',accountId:'100000000000000002',friends}};
 const overlay=new NativeOverlay({BrowserWindow,resources:path.join(root,'output/native-overlay-build/Release'),preload:path.join(root,'preload.js'),url:require('node:url').pathToFileURL(path.join(root,'app/index.html')).href,getTarget:async()=>({pid:game.pid,path:target,game:{key:'steam:1',provider:'steam',id:'1',name:'Example game'}}),mainWindow:{show(){global.fixtureUnexpected.push('show');},focus(){global.fixtureUnexpected.push('focus');}}});global.fixtureOverlay=overlay;
 const replies={
  'library:read':()=>({games:[],favorites:[],history:{},scanRevision:6,lastScan:new Date().toISOString()}),
  'contacts:read':()=>({groups:[],splits:[]}),
  'platforms:state':()=>model,
  'platforms:messages':()=>({messages:[]}),
  'chainlens:state':()=>({signedIn:false}),
  'chainlens:call':action=>action==='identityFriends'?{links:[]}:action==='friends'?{friends:[],incoming:[],outgoing:[]}:{},
  'appearance:theme':()=>Theme.defaults,
  'appearance:logo':()=>({logoVariant:'blue',logoAnimated:false}),
  'settings:desktop':()=>({nativeMode:true,background:true,overlayEnabled:true,trayAvailable:true,shortcutRegistered:true}),
  'settings:startup':()=>({available:false}),
  'window:state':()=>overlay.public(),
  'window:action':action=>{if(action==='dismiss-overlay')overlay.hide();else global.fixtureUnexpected.push(action);return overlay.public();},
  'installs:state':()=>({jobs:[],active:0}),
  'library:stores':()=>['steam','discord'],
  'discover:preferences':()=>({stores:['steam'],region:'CA'}),
  'platforms:send':()=>{throw Error('This fixture never sends messages.');}
 };
 for(const [channel,fn]of Object.entries(replies))ipcMain.handle(channel,(_event,...args)=>fn(...args));
 await overlay.toggle();
}).catch(error=>{console.error(error);app.exit(1);});
app.on('before-quit',()=>{global.fixtureOverlay?.close();global.fixtureGame?.kill();});
