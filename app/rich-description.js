(function(root){
 'use strict';
 const hosts=new Set(['cdn.cloudflare.steamstatic.com','shared.fastly.steamstatic.com','shared.akamai.steamstatic.com','cdn.akamai.steamstatic.com','images.gog.com','items.gog.com','store-images.s-microsoft.com','store-images.microsoft.com','cdn1.epicgames.com','cdn2.unrealengine.com']);
 function imageURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(hosts.has(u.hostname)||/^(images|images-\d)\.gog-statics\.com$/.test(u.hostname))?u.href:null;}catch{return null;}}
 function render(html,doc=root.document){
  const output=doc.createElement('div');output.className='discover-rich-description';
  // Template contents stay inert. Only new, allowlisted nodes are attached to the UI.
  const source=doc.createElement('template');source.innerHTML=typeof html==='string'?html.slice(0,120000):'';
  const allowed=new Set(['P','DIV','H2','H3','H4','UL','OL','LI','STRONG','EM','B','I','BR','BLOCKQUOTE','FIGURE','FIGCAPTION']);
  const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','VIDEO','AUDIO','FORM','INPUT','BUTTON','SELECT','TEXTAREA','LINK','META','TEMPLATE','NOSCRIPT']);
  let nodes=0,characters=0,images=0;
  function walk(node,parent,depth){
   if(++nodes>2000||depth>24||characters>=30000)return;
   if(node.nodeType===3){if(/^product_feature_\d+$/.test(node.textContent.trim()))return;const text=node.textContent.replace(/\s+/g,' ').slice(0,30000-characters);characters+=text.length;parent.append(doc.createTextNode(text));return;}
   if(node.nodeType!==1||blocked.has(node.tagName))return;
   if(node.tagName==='IMG'){
    const url=imageURL(node.getAttribute('src'));if(!url||images>=12)return;images++;
    const img=doc.createElement('img');img.src=url;img.alt=(node.getAttribute('alt')||'').slice(0,200);img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
    img.onerror=()=>{let parent=img.parentElement;img.remove();while(parent&&parent!==output&&!parent.textContent.trim()&&!parent.querySelector('img')){const next=parent.parentElement;parent.remove();parent=next;}if(!output.textContent.trim()&&!output.querySelector('img'))output.remove();};
    parent.append(img);return;
   }
   if(node.tagName==='BR'){const previous=[...parent.childNodes].reverse().find(n=>n.nodeType!==3||n.textContent.trim());if(previous&&!['BR','P','DIV','H2','H3','H4','UL','OL','LI','BLOCKQUOTE','FIGURE'].includes(previous.nodeName))parent.append(doc.createElement('br'));return;}
   const target=allowed.has(node.tagName)?doc.createElement(node.tagName.toLowerCase()):parent;
   for(const child of node.childNodes)walk(child,target,depth+1);
   if(target!==parent&&(target.textContent.trim()||target.querySelector('img')))parent.append(target);
  }
  for(const node of source.content.childNodes)walk(node,output,0);
  return output;
 }
 const api={render,imageURL};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NexusDescription=api;
})(typeof window==='undefined'?globalThis:window);
