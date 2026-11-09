const test=require('node:test'),assert=require('node:assert/strict');
const {startupTarget,startupEnabled}=require('../lib/window-settings');
test('Startup targets the permanent portable executable rather than its extracted temporary copy',()=>{
 const target=startupTarget({packaged:true,platform:'win32',portableExecutable:'C:\\Games\\The Nexus.exe',execPath:'C:\\Temp\\portable\\The Nexus.exe'});
 assert.deepEqual(target,{name:'The Nexus',path:'C:\\Games\\The Nexus.exe',args:[]});
 assert.equal(startupTarget({packaged:false,platform:'win32'}),null);
 assert.equal(startupTarget({packaged:true,platform:'linux'}),null);
 assert.throws(()=>startupTarget({packaged:true,platform:'win32',portableExecutable:'relative.exe'}));
});
test('Startup reads its own approved Windows entry even when the default Electron entry is absent',()=>{
 const target={name:'The Nexus',path:'C:\\Games\\Nexus.exe',args:[]};
 const item={...target,scope:'user',enabled:true};
 assert.equal(startupEnabled({openAtLogin:false,launchItems:[item]},target),true);
 for(const changes of [{enabled:false},{name:'Other app'},{path:'C:\\Temp\\Nexus.exe'},{scope:'machine'},{args:['other']}])assert.equal(startupEnabled({launchItems:[{...item,...changes}]},target),false);
});
