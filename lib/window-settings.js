'use strict';
const path=require('node:path');
const STARTUP_NAME='The Nexus';
function startupTarget({packaged,platform,portableExecutable,execPath}){
 if(!packaged||platform!=='win32')return null;
 const executable=portableExecutable||execPath;
 if(typeof executable!=='string'||!path.win32.isAbsolute(executable)||!executable.toLowerCase().endsWith('.exe'))throw Error('The launcher executable could not be located.');
 return {name:STARTUP_NAME,path:executable,args:[]};
}
function startupEnabled(settings,target){
 // Electron's openAtLogin checks its default entry name; ours is explicitly named.
 return (settings.launchItems||[]).some(item=>item.name===target.name&&item.scope==='user'&&item.enabled&&typeof item.path==='string'&&path.win32.normalize(item.path).toLowerCase()===path.win32.normalize(target.path).toLowerCase()&&Array.isArray(item.args)&&item.args.length===0);
}
module.exports={startupTarget,startupEnabled};
