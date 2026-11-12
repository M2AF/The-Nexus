'use strict';
const HOTKEY='Alt+C';
function desktopPreferences(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid background settings.');
 for(const key of Object.keys(value))if(!['background','overlayEnabled'].includes(key)||typeof value[key]!=='boolean')throw Error('Invalid background settings.');
 return {background:value.background!==false,overlayEnabled:value.overlayEnabled!==false};
}
class DesktopLifecycle{
 constructor({nativeOverlay,app,win,Tray,Menu,globalShortcut,screen,icon,preferences={},onPreferences=()=>{},onChange=()=>{},getGame=async()=>null}){
  Object.assign(this,{nativeOverlay,app,win,Menu,globalShortcut,screen,icon,onPreferences,onChange,getGame});this.preferences=desktopPreferences(preferences);this.overlay=false;this.game=null;this.generation=0;this.shortcutRegistered=false;this.quitting=false;
  try{this.tray=new Tray(icon);this.tray.setToolTip('The Nexus · Alt+C for friends');this.tray.on('click',()=>this.showMain());this.tray.on('double-click',()=>this.showMain());}catch{this.tray=null;}
  win.on('close',event=>{if(this.quitting)return;if(this.overlay){event.preventDefault();this.dismissOverlay();}else if(this.preferences.background&&this.tray){event.preventDefault();win.hide();}});
  win.on('query-session-end',()=>{this.quitting=true;});
  app.on('before-quit',()=>{this.quitting=true;this.dispose();});
  this.registerShortcut();this.menu();
 }
 public(){return {overlay:this.overlay,overlayGame:this.game,nativeAvailable:!!this.nativeOverlay?.available(),nativeMode:!!this.nativeOverlay,background:this.preferences.background,overlayEnabled:this.preferences.overlayEnabled,shortcut:HOTKEY,shortcutRegistered:this.shortcutRegistered,trayAvailable:!!this.tray};}
 notify(){this.onChange(this.public());}
 registerShortcut(){if(this.shortcutRegistered)this.globalShortcut.unregister(HOTKEY);this.shortcutRegistered=false;if(this.preferences.overlayEnabled){try{this.shortcutRegistered=this.globalShortcut.register(HOTKEY,()=>this.nativeOverlay?this.nativeOverlay.hotkey():this.toggleOverlay());}catch{}}}
 menu(){this.tray?.setContextMenu(this.Menu.buildFromTemplate([{label:'Open The Nexus',click:()=>this.showMain()},{label:'Friends overlay (Alt+C)',enabled:this.preferences.overlayEnabled,click:()=>this.toggleOverlay()},{type:'separator'},{label:'Quit The Nexus',click:()=>this.quit()}]));}
 settings(value){if(value!==undefined){desktopPreferences(value);this.preferences=desktopPreferences({...this.preferences,...value});this.registerShortcut();this.menu();if(!this.preferences.overlayEnabled)this.dismissOverlay();this.onPreferences(this.preferences);this.notify();}return this.public();}
 async toggleOverlay(){if(!this.preferences.overlayEnabled)return this.public();if(this.nativeOverlay)return this.nativeOverlay.toggle();if(this.overlay){this.dismissOverlay();return this.public();}if(!this.preferences.overlayEnabled)return this.public();
  if(!this.saved)this.saved={bounds:this.win.getNormalBounds(),minimum:this.win.getMinimumSize(),maximized:this.win.isMaximized(),fullscreen:this.win.isFullScreen()};
  this.overlay=true;this.game=null;const generation=++this.generation;
  this.win.setFullScreen(false);if(this.win.isMinimized())this.win.restore();if(this.win.isMaximized())this.win.unmaximize();
  const area=this.screen.getDisplayNearestPoint(this.screen.getCursorScreenPoint()).workArea,width=Math.min(1100,area.width),height=Math.min(800,area.height);
  this.win.setMinimumSize(Math.min(640,width),Math.min(420,height));this.win.setBounds({x:Math.round(area.x+(area.width-width)/2),y:Math.round(area.y+(area.height-height)/2),width,height});
  this.win.setSkipTaskbar(true);this.win.show();this.win.setAlwaysOnTop(true,'screen-saver');this.win.focus();this.notify();
  try{const game=await this.getGame();if(this.overlay&&generation===this.generation){this.game=game;this.notify();}}catch{}
  return this.public();
 }
 dismissOverlay(){this.nativeOverlay?.hide();if(!this.overlay)return;this.generation++;this.overlay=false;this.game=null;this.win.setAlwaysOnTop(false);this.win.setSkipTaskbar(false);if(this.tray)this.win.hide();else this.showMain();this.notify();}
 showMain(){this.nativeOverlay?.hide();this.generation++;this.overlay=false;this.game=null;this.win.setAlwaysOnTop(false);this.win.setSkipTaskbar(false);
  const saved=this.saved;this.saved=null;if(saved){this.win.setMinimumSize(...saved.minimum);this.win.setBounds(saved.bounds);}
  if(this.win.isMinimized())this.win.restore();this.win.show();if(saved?.maximized)this.win.maximize();if(saved?.fullscreen)this.win.setFullScreen(true);this.win.focus();this.notify();return this.public();
 }
 updateIcon(icon){this.tray?.setImage(icon);}
 quit(){if(this.quitting)return;this.quitting=true;this.app.quit();}
 dispose(){this.generation++;if(this.shortcutRegistered)this.globalShortcut.unregister(HOTKEY);this.shortcutRegistered=false;this.tray?.destroy();this.tray=null;}
}
module.exports={DesktopLifecycle,desktopPreferences,HOTKEY};
