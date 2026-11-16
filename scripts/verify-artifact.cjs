'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..'),directory=path.join(root,'dist'),version=require('../package.json').version;
 const archive=path.resolve(root,process.env.NEXUS_ASAR||(process.platform==='win32'?'dist/win-unpacked/resources/app.asar':'dist/linux-unpacked/resources/app.asar'));
 const asar=await import('@electron/asar');const entries=asar.listPackage(archive).map(name=>name.replaceAll('\\','/'));
 const productionVersions=new Set(Object.entries(require('../package-lock.json').packages).filter(([name,info])=>name.startsWith('node_modules/')&&!info.dev).map(([name,info])=>(info.name||name.split('node_modules/').at(-1))+'@'+info.version));
 // electron-builder hoists some nested runtime packages. Verify the pinned
 // production name/version rather than requiring npm's original folder depth.
 const packages=[];
 for(const entry of entries.filter(name=>/\/node_modules\/(?:@[^/]+\/)?[^/]+\/package\.json$/.test(name))){
  const info=JSON.parse(asar.extractFile(archive,path.normalize(entry.slice(1))).toString());
  if(productionVersions.has(info.name+'@'+String(info.version).replace(/^v/,'')))packages.push(entry.slice(0,-'/package.json'.length));
 }
 function productionDependency(name){
  if(packages.some(pkg=>pkg===name||pkg.startsWith(name+'/')))return true;
  const matches=[...name.matchAll(/\/node_modules\/(?:@[^/]+\/)?[^/]+/g)];if(!matches.length)return false;
  const last=matches.at(-1),pkg=name.slice(0,last.index+last[0].length);return packages.includes(pkg);
 }
 const unexpected=entries.filter(name=>!/^\/(?:app(?:\/|$)|lib(?:\/|$)|main\.js$|preload\.js$|package\.json$)/.test(name)&&!productionDependency(name));
 if(unexpected.length)throw Error('Unexpected packaged files: '+unexpected.join(', '));
 // Valve's distributed signature-verification PUBLIC key is runtime code data.
 // Allow only these exact upstream bytes; all other key files remain forbidden.
 const valveKey='/node_modules/@doctormckay/steam-crypto/system.pem';
 if(entries.includes(valveKey)&&crypto.createHash('sha256').update(asar.extractFile(archive,path.normalize(valveKey.slice(1)))).digest('hex')!=='68f5a4bb66fde15b6cb3945cb14349f8b907837782c68a99571161bdd636182a')throw Error('Steam public verification key changed. Review the upstream package.');
 const sensitive=entries.filter(name=>name!==valveKey&&/(?:^|\/)(?:\.env(?:\..*)?|library\.json|contacts\.json|installations\.json|platform-sessions\.enc.*|discover-cache\.json|discover-preferences\.json|chainlens-session.*|.*\.(?:db|sqlite|log|pem|pfx|key))$/.test(name));
 if(sensitive.length)throw Error('Personal/runtime data must not be packaged: '+sensitive.join(', '));
 const resources=path.dirname(archive),native=process.platform==='win32'?'win32-x64/discord_partner_sdk.dll':'linux-x64/libdiscord_partner_sdk.so';
 for(const relative of [native,'License-Notices.txt']){
  const source=fs.readFileSync(path.join(root,'native/discord',relative)),packaged=fs.readFileSync(path.join(resources,'discord',relative));
  if(!source.equals(packaged))throw Error('Discord SDK resource mismatch: '+relative);
 }
 const expected=process.platform==='win32'?`The-Nexus-${version}-portable.exe`:`The-Nexus-${version}-linux-x86_64.AppImage`;
 const file=path.join(directory,expected);if(!fs.existsSync(file))throw Error('Build artifact is missing: '+expected);
 const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);
 const sha256=hash.digest('hex');fs.writeFileSync(file+'.sha256',`${sha256}  ${expected}\n`);
 fs.writeFileSync(path.join(directory,`build-info-${process.platform}.json`),JSON.stringify({version,platform:process.platform,arch:process.arch,commit:process.env.GITHUB_SHA||null,packagedFiles:entries.length,personalDataIncluded:false,artifact:expected,sha256},null,2));
 console.log('Verified package allowlist and generated SHA-256 for '+expected);
})().catch(error=>{console.error(error);process.exitCode=1;});
