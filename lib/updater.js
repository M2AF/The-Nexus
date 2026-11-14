'use strict';
// GitHub release updater for the portable Windows executable and the Linux AppImage.
// Only published, non-prerelease GitHub releases are considered. Every download is
// size- and SHA-256-verified against the release's .sha256 asset (and GitHub's own
// asset digest when present) before it can replace the running executable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const REPOSITORY='M2AF/The-Nexus';
const RELEASE_API=`https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const RELEASE_PAGE=`https://github.com/${REPOSITORY}/releases/`;
const DOWNLOAD_HOSTS=new Set(['github.com','objects.githubusercontent.com','release-assets.githubusercontent.com']);
const CHECK_DELAY=15000,CHECK_INTERVAL=6*3600000,MAX_SIZE=1e9,MIN_SIZE=1e6;
const PARTIAL=/^\.The-Nexus-update-.+\.partial$/;

function parseVersion(value){const m=/^v?(\d{1,5})\.(\d{1,5})\.(\d{1,5})$/.exec(String(value||'').trim());return m?m.slice(1).map(Number):null;}
function isNewer(candidate,current){const a=parseVersion(candidate),b=parseVersion(current);if(!a||!b)return false;for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;}
function assetName(version,platform){return platform==='win32'?`The-Nexus-${version}-portable.exe`:platform==='linux'?`The-Nexus-${version}-linux-x86_64.AppImage`:null;}
function trustedDownload(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&DOWNLOAD_HOSTS.has(u.hostname);}catch{return false;}}
function releasePage(value,version){return typeof value==='string'&&value.startsWith(RELEASE_PAGE)&&!/[\s"'<>]/.test(value)?value:RELEASE_PAGE+'tag/v'+version;}
function parseChecksum(text,name){for(const line of String(text||'').split(/\r?\n/)){const m=/^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/.exec(line);if(m&&m[2]===name)return m[1].toLowerCase();}return null;}
// Returns null when the release is not newer than the running version. `asset` is null when
// the release has no verifiable build for this platform (the user can still open the page).
function selectRelease(release,{currentVersion,platform}){
 if(!release||typeof release!=='object'||release.draft||release.prerelease)return null;
 const version=String(release.tag_name||'').replace(/^v/,'');if(!parseVersion(version)||!isNewer(version,currentVersion))return null;
 const name=assetName(version,platform),assets=Array.isArray(release.assets)?release.assets:[];
 const binary=assets.find(a=>a?.name===name),checksum=assets.find(a=>a?.name===name+'.sha256');
 const usable=binary&&checksum&&trustedDownload(binary.browser_download_url)&&trustedDownload(checksum.browser_download_url)&&Number.isSafeInteger(binary.size)&&binary.size>=MIN_SIZE&&binary.size<=MAX_SIZE;
 const digest=/^sha256:([a-f0-9]{64})$/i.exec(String(binary?.digest||''))?.[1]?.toLowerCase()||null;
 return {version,page:releasePage(release.html_url,version),publishedAt:typeof release.published_at==='string'?release.published_at:null,asset:usable?{name,url:binary.browser_download_url,size:binary.size,checksumUrl:checksum.browser_download_url,digest}:null};
}
// Only self-contained packaged builds can replace themselves: the portable .exe and the AppImage.
function installTarget({packaged,platform,env}){
 if(!packaged)return null;
 if(platform==='win32'&&env.PORTABLE_EXECUTABLE_FILE&&path.isAbsolute(env.PORTABLE_EXECUTABLE_FILE))return {kind:'portable',file:env.PORTABLE_EXECUTABLE_FILE};
 if(platform==='linux'&&env.APPIMAGE&&path.isAbsolute(env.APPIMAGE))return {kind:'appimage',file:env.APPIMAGE};
 return null;
}
// The old AppImage mount disappears when this process exits, so do not leak its paths to the new one.
function relaunchEnv(env){const next={...env},mount=env.APPDIR;for(const name of ['APPDIR','APPIMAGE','ARGV0','OWD','PORTABLE_EXECUTABLE_FILE','PORTABLE_EXECUTABLE_DIR','PORTABLE_EXECUTABLE_APP_FILENAME'])delete next[name];if(mount&&next.LD_LIBRARY_PATH)next.LD_LIBRARY_PATH=next.LD_LIBRARY_PATH.split(':').filter(part=>part&&!part.startsWith(mount)).join(':');if(next.LD_LIBRARY_PATH==='')delete next.LD_LIBRARY_PATH;return next;}

class Updater{
 constructor({currentVersion,platform,target=null,fetchImpl=globalThis.fetch,onChange=()=>{},now=Date.now,fsImpl=fs}){
  Object.assign(this,{platform,target,fetch:fetchImpl,onChange,now,fs:fsImpl});this.release=null;this.staged=null;this.job=null;this.download=null;this.timers=[];
  this.state={status:'idle',currentVersion,version:null,progress:0,message:'',checkedAt:null,page:null,installable:!!target,publishedAt:null};
 }
 public(){return {...this.state};}
 set(patch){Object.assign(this.state,patch);try{this.onChange(this.public());}catch{}}
 start(){this.cleanup();const first=setTimeout(()=>this.check().catch(()=>{}),CHECK_DELAY),every=setInterval(()=>this.check().catch(()=>{}),CHECK_INTERVAL);first.unref?.();every.unref?.();this.timers.push(first,every);}
 stop(){for(const timer of this.timers){clearTimeout(timer);clearInterval(timer);}this.timers=[];this.abort?.abort();}
 // Remove the previous executable (kept as *.old while it was still running) and abandoned downloads.
 cleanup(attempt=0){
  if(!this.target)return;const dir=path.dirname(this.target.file),old=this.target.file+'.old';let pending=false;
  try{if(this.fs.existsSync(old))this.fs.unlinkSync(old);}catch{pending=true;}
  try{for(const name of this.fs.readdirSync(dir))if(PARTIAL.test(name))try{this.fs.unlinkSync(path.join(dir,name));}catch{}}catch{}
  if(pending&&attempt<5){const retry=setTimeout(()=>this.cleanup(attempt+1),4000);retry.unref?.();this.timers.push(retry);}
 }
 async request(url,accept,signal){
  let target=url;for(let i=0;i<5;i++){
   if(target!==RELEASE_API&&!trustedDownload(target))throw Error('Update download left GitHub.');
   const response=await this.fetch(target,{redirect:'manual',signal:signal||AbortSignal.timeout(20000),headers:{Accept:accept,'User-Agent':'The-Nexus-Updater','X-GitHub-Api-Version':'2022-11-28'}});
   if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');if(!location)throw Error('GitHub redirect was incomplete.');target=new URL(location,target).href;continue;}
   if(response.status===403||response.status===429)throw Error('GitHub is limiting update checks. Try again later.');
   if(!response.ok)throw Error(`GitHub returned ${response.status}.`);return response;
  }throw Error('Too many GitHub redirects.');
 }
 check({manual=false}={}){
  if(this.job)return this.job;if(['downloading','ready'].includes(this.state.status))return Promise.resolve(this.public());
  this.job=(async()=>{
   this.set({status:'checking',message:'Checking GitHub for a new version…'});
   try{
    const response=await this.request(RELEASE_API,'application/vnd.github+json'),text=await response.text();if(text.length>2e6)throw Error('GitHub release response was too large.');
    const release=selectRelease(JSON.parse(text),{currentVersion:this.state.currentVersion,platform:this.platform});this.release=release;
    if(!release){this.set({status:'current',version:null,page:null,checkedAt:this.now(),message:'You have the latest version.'});return this.public();}
    const installable=!!(this.target&&release.asset);
    this.set({status:'available',version:release.version,page:release.page,publishedAt:release.publishedAt,checkedAt:this.now(),installable,progress:0,message:installable?`Version ${release.version} is available.`:`Version ${release.version} is available on GitHub.`});
    if(installable)this.startDownload();
   }catch(error){this.set({status:'error',checkedAt:this.now(),message:manual?error.message:'Could not check for updates. '+error.message});}
   return this.public();
  })().finally(()=>{this.job=null;});
  return this.job;
 }
 startDownload(){if(!this.download)this.download=this.fetchUpdate().catch(error=>{this.set({status:'error',progress:0,message:'Update download failed: '+error.message});}).finally(()=>{this.download=null;});return this.download;}
 async fetchUpdate(){
  const {asset,version}=this.release,dir=path.dirname(this.target.file),staged=path.join(dir,`.The-Nexus-update-${version}.partial`);
  this.set({status:'downloading',progress:0,message:`Downloading version ${version}…`});
  const listed=parseChecksum(await (await this.request(asset.checksumUrl,'application/octet-stream')).text(),asset.name);
  if(!listed)throw Error('The release checksum file is missing or invalid.');
  if(asset.digest&&asset.digest!==listed)throw Error('The release checksums do not match.');
  this.abort=new AbortController();const timeout=setTimeout(()=>this.abort.abort(),30*60000);
  const hash=crypto.createHash('sha256');let file,received=0,reported=0;
  try{
   const response=await this.request(asset.url,'application/octet-stream',this.abort.signal);
   const declared=Number(response.headers.get('content-length'));if(declared&&declared!==asset.size)throw Error('The download size does not match the release.');
   file=await this.fs.promises.open(staged,'w');
   for await(const chunk of response.body){received+=chunk.length;if(received>asset.size)throw Error('The download is larger than the release.');hash.update(chunk);await file.write(chunk);const progress=Math.floor(received*100/asset.size);if(progress>reported){reported=progress;this.set({progress});}}
   await file.close();file=null;
   if(received!==asset.size)throw Error('The download was incomplete.');
   if(hash.digest('hex')!==listed)throw Error('The download failed its SHA-256 check.');
  }catch(error){await file?.close().catch(()=>{});try{this.fs.unlinkSync(staged);}catch{}if(['EACCES','EPERM','EROFS'].includes(error.code))throw Error('This folder is read-only. Move The Nexus to a folder you can write to, or download the update from GitHub.');throw error;}
  finally{clearTimeout(timeout);this.abort=null;}
  this.staged=staged;this.set({status:'ready',progress:100,message:`Version ${version} is ready. Restart to finish updating.`});
 }
 // Swap the verified download into place. Returns what the main process should do next.
 install(){
  if(this.state.status==='available'&&!this.state.installable&&this.state.page)return {action:'open',url:this.state.page};
  if(this.state.status!=='ready'||!this.staged||!this.target)throw Error('No downloaded update is ready.');
  const file=this.target.file,staged=this.staged;
  if(this.target.kind==='portable'){
   // A running Windows executable can be renamed but not deleted; the next launch removes *.old.
   const old=file+'.old';try{this.fs.unlinkSync(old);}catch{}
   this.fs.renameSync(file,old);try{this.fs.renameSync(staged,file);}catch(error){this.fs.renameSync(old,file);throw error;}
  }else{this.fs.chmodSync(staged,0o755);this.fs.renameSync(staged,file);}
  this.staged=null;this.set({status:'restarting',message:'Restarting The Nexus…'});
  return {action:'relaunch',file,env:relaunchEnv(process.env)};
 }
 relaunchFailed(error){this.set({status:'error',message:'The update is installed, but The Nexus could not restart itself ('+error.message+'). Close and reopen it to finish.'});}
}
module.exports={Updater,RELEASE_API,parseVersion,isNewer,assetName,trustedDownload,parseChecksum,selectRelease,installTarget,relaunchEnv};
