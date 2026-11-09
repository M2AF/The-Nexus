const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ChainLensClient,validGif}=require('../lib/chainlens-client');
const ID='11111111-1111-4111-8111-111111111111',FRIEND='22222222-2222-4222-8222-222222222222';
async function fixture(t,{slowConfig=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-session-')),tokens=new Set(),grants=new Map(),opened=[],calls=[];let origin;
 const server=http.createServer(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):{},url=new URL(req.url,origin);res.setHeader('Content-Type','application/json');const send=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));};calls.push({path:url.pathname,method:req.method});
  if(url.pathname==='/api/nexus/config'){if(slowConfig)await new Promise(resolve=>setTimeout(resolve,80));return send(200,{enabled:true,client_id:'nexus-desktop',scope:'social',authorization_endpoint:origin+'/auth/nexus',token_endpoint:origin+'/api/nexus/token'});}
  if(url.pathname==='/api/nexus/token'){const grant=grants.get(body.code);grants.delete(body.code);if(!grant||grant.redirect!==body.redirect_uri||grant.challenge!==crypto.createHash('sha256').update(body.code_verifier||'').digest('base64url'))return send(400,{error:'invalid_grant'});const token='nxs_'+crypto.randomBytes(32).toString('hex');tokens.add(token);return send(200,{access_token:token,scope:'social',expires_in:600,user:{id:ID}});}
  const token=req.headers.authorization?.replace('Bearer ','');if(!tokens.has(token))return send(401,{error:'expired'});
  if(url.pathname==='/api/nexus/me')return send(200,{user:{id:ID,name:'Fixture User'},access:{eligible:true,walletLinked:true,socialLinked:true},gif_search:true});
  if(url.pathname==='/api/nexus/logout'){tokens.delete(token);return send(200,{signed_out:true});}
  if(url.pathname.endsWith('/presence'))return send(200,{success:true});
  if(url.pathname.endsWith('/friends'))return send(200,{friends:[{id:FRIEND,display_name:'Fixture Friend'}],incoming:[],outgoing:[]});
  return send(200,{messages:[]});
 });server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin='http://127.0.0.1:'+server.address().port;
 const encryptionKey=crypto.randomBytes(32),safeStorage={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async text=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey,iv),body=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]);},decryptStringAsync:async bytes=>{const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return {result:Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'),shouldReEncrypt:false};}};
 const options={directory,safeStorage,origin,allowLoopback:true,openExternal:async url=>opened.push(url)},client=new ChainLensClient(options);t.after(async()=>{client.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});});
 const callback=(change={})=>{const auth=new URL(opened.at(-1)),code=crypto.randomBytes(32).toString('hex');grants.set(code,{redirect:auth.searchParams.get('redirect_uri'),challenge:auth.searchParams.get('code_challenge')});const target=new URL(auth.searchParams.get('redirect_uri'));target.searchParams.set('state',auth.searchParams.get('state'));target.searchParams.set('code',code);for(const [key,value]of Object.entries(change))target.searchParams.set(key,value);return target;};
 return {client,options,callback,opened,calls,tokens,directory};
}
test('desktop sign-in checks state/PKCE, stores ciphertext only, restores identity, and revokes logout',async t=>{
 const f=await fixture(t);await f.client.login();const bad=await fetch(f.callback({state:'0'.repeat(64)}));assert.equal(bad.status,400);assert(f.client.public().pending);
 const response=await fetch(f.callback());assert.equal(response.status,200);await response.text();assert.equal(f.client.public().user.id,ID);assert.equal(f.client.public().remembered,true);assert(!JSON.stringify(f.client.public()).includes('nxs_'));assert(!fs.readFileSync(path.join(f.directory,'chainlens-session.enc')).includes(Buffer.from('nxs_')));
 const restored=new ChainLensClient(f.options);await restored.restore();assert.equal(restored.public().user.id,ID);const friends=await restored.action('friends');assert.equal(friends.friends[0].id,FRIEND);await restored.logout();assert.equal(restored.public().signedIn,false);assert.equal(f.tokens.size,0);assert.equal(fs.existsSync(path.join(f.directory,'chainlens-session.enc')),false);restored.close();
});
test('canceling in-flight configuration never opens a browser or leaves a callback listener',async t=>{const f=await fixture(t,{slowConfig:true}),pending=f.client.login();f.client.cancelLogin();await pending;assert.equal(f.opened.length,0);assert.equal(f.client.public().pending,false);});
test('untrusted origins, arbitrary operations, malformed recipients and media fail before transport',async t=>{
 assert.throws(()=>new ChainLensClient({origin:'https://evil.example'}),/Untrusted/);assert.equal(validGif('https://giphy.com.evil.example/x.gif'),false);assert.equal(validGif('file:///x.gif'),false);
 const f=await fixture(t);await f.client.login();await fetch(f.callback()).then(response=>response.text());const before=f.calls.length;
 await assert.rejects(f.client.action('wallets'),/Unsupported/);await assert.rejects(f.client.action('send',{friendId:'../profile',type:'text',content:'Hi'}),/ChainLens ID/);await assert.rejects(f.client.action('send',{friendId:FRIEND,type:'gif',content:'https://evil.example/gif.gif'}),/GIPHY/);await assert.rejects(f.client.action('send',{friendId:FRIEND,type:'text',content:'a'.repeat(501)}),/500/);assert.equal(f.calls.length,before);
 f.client.credential.expires=Date.now()-1;await assert.rejects(f.client.action('friends'),/Sign in/);assert.equal(f.client.public().signedIn,false);
});
