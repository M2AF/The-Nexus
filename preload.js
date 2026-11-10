const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('chainlens',{
 state:()=>ipcRenderer.invoke('chainlens:state'),login:()=>ipcRenderer.invoke('chainlens:login'),cancel:()=>ipcRenderer.invoke('chainlens:cancel'),logout:()=>ipcRenderer.invoke('chainlens:logout'),retry:()=>ipcRenderer.invoke('chainlens:retry'),profile:()=>ipcRenderer.invoke('chainlens:profile'),
 call:(action,args)=>ipcRenderer.invoke('chainlens:call',action,args),
 refresh:()=>ipcRenderer.invoke('chainlens:refresh'),
 onChange:callback=>{const listener=(_event,status)=>callback(status);ipcRenderer.on('chainlens:changed',listener);return ()=>ipcRenderer.removeListener('chainlens:changed',listener);}
});
contextBridge.exposeInMainWorld('nexus', {
  windowState:()=>ipcRenderer.invoke('window:state'),
  windowAction:action=>ipcRenderer.invoke('window:action',action),
  onWindowChange:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('window:changed',listener);return ()=>ipcRenderer.removeListener('window:changed',listener);},
  startup:enabled=>ipcRenderer.invoke('settings:startup',enabled),
  theme:value=>ipcRenderer.invoke('appearance:theme',value),
  logo:variant=>ipcRenderer.invoke('appearance:logo',variant),
  discover:options=>ipcRenderer.invoke('discover:browse',options),
  discoverDetails:(key,region)=>ipcRenderer.invoke('discover:details',key,region),
  discoverPreview:(key,region)=>ipcRenderer.invoke('discover:preview',key,region),
  discoverPreferences:value=>ipcRenderer.invoke('discover:preferences',value),
  discoverOwnership:()=>ipcRenderer.invoke('discover:ownership'),
  discoverOpen:(key,provider,region)=>ipcRenderer.invoke('discover:open',key,provider,region),
  read: () => ipcRenderer.invoke('library:read'),
  libraryStores:stores=>ipcRenderer.invoke('library:stores',stores),
  scan: () => ipcRenderer.invoke('library:scan'),
  favorite: id => ipcRenderer.invoke('library:favorite', id),
  launch: id => ipcRenderer.invoke('library:launch', id),
  folder: id => ipcRenderer.invoke('library:folder', id),
  artwork: id => ipcRenderer.invoke('library:artwork', id),
  remove: id => ipcRenderer.invoke('library:remove', id),
  add: () => ipcRenderer.invoke('library:add'),
  addRoot: () => ipcRenderer.invoke('library:addRoot'),
  syncOwned: (account,itchAccount) => ipcRenderer.invoke('owned:sync',account,itchAccount),
  addWebGame: url => ipcRenderer.invoke('web:add',url),
  importOwned: () => ipcRenderer.invoke('owned:import'),
  openClient: id => ipcRenderer.invoke('library:openClient',id),
  export: () => ipcRenderer.invoke('library:export')
});
