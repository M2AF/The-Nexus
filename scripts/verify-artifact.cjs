'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..'),directory=path.join(root,'dist'),version=require('../package.json').version;
 const archive=path.resolve(root,process.env.NEXUS_ASAR||(process.platform==='win32'?'dist/win-unpacked/resources/app.asar':'dist/linux-unpacked/resources/app.asar'));
 const asar=await import('@electron/asar');const entries=asar.listPackage(archive).map(name=>name.replaceAll('\\','/'));
 const unexpected=entries.filter(name=>!/^\/(?:app(?:\/|$)|lib(?:\/|$)|main\.js$|preload\.js$|package\.json$)/.test(name));
 if(unexpected.length)throw Error('Unexpected packaged files: '+unexpected.join(', '));
 const sensitive=entries.filter(name=>/(?:^|\/)(?:\.env(?:\..*)?|library\.json|discover-cache\.json|discover-preferences\.json|chainlens-session.*|.*\.(?:db|sqlite|log|pem|pfx|key))$/.test(name));
 if(sensitive.length)throw Error('Personal/runtime data must not be packaged: '+sensitive.join(', '));
 const expected=process.platform==='win32'?`The-Nexus-${version}-portable.exe`:`The-Nexus-${version}-linux-x86_64.AppImage`;
 const file=path.join(directory,expected);if(!fs.existsSync(file))throw Error('Build artifact is missing: '+expected);
 const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);
 const sha256=hash.digest('hex');fs.writeFileSync(file+'.sha256',`${sha256}  ${expected}\n`);
 fs.writeFileSync(path.join(directory,`build-info-${process.platform}.json`),JSON.stringify({version,platform:process.platform,arch:process.arch,commit:process.env.GITHUB_SHA||null,packagedFiles:entries.length,personalDataIncluded:false,artifact:expected,sha256},null,2));
 console.log('Verified package allowlist and generated SHA-256 for '+expected);
})().catch(error=>{console.error(error);process.exitCode=1;});
