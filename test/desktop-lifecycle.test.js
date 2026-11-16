'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {DesktopLifecycle,desktopPreferences}=require('../lib/desktop-lifecycle');
function fixture(options={}){
 const app=new EventEmitter(),win=new EventEmitter();app.quit=()=>{app.emit('before-quit');app.quitCalled=true;};
 Object.assign(win,{bounds:{x:40,y:50,width:1400,height:900},minimum:[800,600],maximized:true,fullscreen:false,minimized:false,visible:true,top:false,skip:false,getNormalBounds(){return {...this.bounds};},getMinimumSize(){return [...this.minimum];},isMaximized(){return this.maximized;},isFullScreen(){return this.fullscreen;},isMinimized(){return this.minimized;},setFullScreen(value){this.fullscreen=value;},restore(){this.minimized=false;},unmaximize(){this.maximized=false;},maximize(){this.maximized=true;},setMinimumSize(...value){this.minimum=value;},setBounds(value){this.bounds=value;},setAlwaysOnTop(value){this.top=value;},setSkipTaskbar(value){this.skip=value;},hide(){this.visible=false;},show(){this.visible=true;},focus(){this.focused=true;}});
 class Tray extends EventEmitter{setToolTip(){}setContextMenu(menu){this.menu=menu;}setImage(){}destroy(){this.destroyed=true;}}
 const shortcut={register(_key,callback){this.callback=callback;return options.shortcut!==false;},unregister(){this.callback=null;}};
 const updates=[],saved=[];const lifecycle=new DesktopLifecycle({app,win,Tray:options.noTray?class{constructor(){throw Error('no tray');}}:Tray,Menu:{buildFromTemplate:items=>items},globalShortcut:shortcut,screen:{getCursorScreenPoint:()=>({x:-1500,y:40}),getDisplayNearestPoint:()=>({workArea:{x:-1920,y:0,width:1920,height:1040}})},icon:'icon',getGame:options.getGame||(async()=>({name:'Example game',provider:'steam',id:'1'})),onChange:state=>updates.push(state),onPreferences:state=>saved.push(state)});
 return {app,win,lifecycle,shortcut,updates,saved};
}
test('Closing hides to tray without disconnecting; tray open restores and Quit ends the app',()=>{
 const f=fixture();let prevented=false;f.win.emit('close',{preventDefault(){prevented=true;}});assert(prevented);assert(!f.win.visible);assert(!f.app.quitCalled);
 const tray=f.lifecycle.tray;tray.menu.find(item=>item.label==='Open The Nexus').click();assert(f.win.visible);
 tray.menu.find(item=>item.label==='Quit The Nexus').click();assert(f.app.quitCalled);assert(tray.destroyed);assert.equal(f.shortcut.callback,null);
});
test('Overlay toggles above the active display, restores bounds/maximized state and rejects stale game reads',async()=>{
 let resolve;const f=fixture({getGame:()=>new Promise(done=>resolve=done)}),opening=f.lifecycle.toggleOverlay();assert(f.win.top);assert(f.win.skip);assert(f.win.bounds.x<0);assert.equal(f.win.bounds.width,1100);assert.equal(f.win.bounds.height,800);
 f.lifecycle.dismissOverlay();assert(!f.win.visible);assert(!f.win.top);resolve({name:'stale'});await opening;assert.equal(f.lifecycle.game,null);
 f.lifecycle.showMain();assert.deepEqual(f.win.bounds,{x:40,y:50,width:1400,height:900});assert(f.win.maximized);assert.deepEqual(f.win.minimum,[800,600]);f.lifecycle.dispose();
});
test('Disabling background allows close, disabling overlay removes hotkey, and missing tray cannot strand the app',async()=>{
 const f=fixture();f.lifecycle.settings({background:false,overlayEnabled:false});let prevented=false;f.win.emit('close',{preventDefault(){prevented=true;}});assert(!prevented);assert.equal(f.shortcut.callback,null);assert.equal((await f.lifecycle.toggleOverlay()).overlay,false);assert.equal(f.saved.length,1);
 const noTray=fixture({noTray:true,shortcut:false});assert.equal(noTray.lifecycle.public().trayAvailable,false);noTray.win.emit('close',{preventDefault(){assert.fail('must allow close');}});await noTray.lifecycle.toggleOverlay();noTray.lifecycle.dismissOverlay();assert(noTray.win.visible);assert(!noTray.win.top);noTray.lifecycle.dispose();
 assert.throws(()=>desktopPreferences({background:'yes'}),/Invalid/);assert.throws(()=>f.lifecycle.settings([]),/Invalid/);assert.throws(()=>desktopPreferences({hotkey:'anything'}),/Invalid/);
});
test('Same game uses exact normalized names and real presence, avoiding similarly named games',()=>{
 const {sameGame}=require('../app/same-game'),game={name:'RuneScape: Dragonwilds'};
 assert(sameGame({playing:'RuneScape™: Dragonwilds',online:true},game));assert(!sameGame({playing:'RuneScape',online:true},game));assert(!sameGame({playing:'RuneScape: Dragonwilds',online:false},game));assert(!sameGame({online:true},game));assert(!sameGame({playing:game.name},null));
});
