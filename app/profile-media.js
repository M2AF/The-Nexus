(() => {
 'use strict';
 // Match ChainLens's saved avatar formats. Images never receive account headers.
 function avatarUrl(value){
  if(typeof value!=='string'||value.length>2.8*1024*1024)return null;
  if(/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value))return value;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
 }
 const api={avatarUrl};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.NexusProfileMedia=api;
})();
