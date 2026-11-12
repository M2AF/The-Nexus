((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.NexusContacts=factory();})(typeof globalThis==='object'?globalThis:this,()=>{
'use strict';
const PRIORITY={discord:0,steam:1,xbox:2,epic:3,gog:4,playstation:5,chainlens:99};
const preferred=members=>[...members].sort((a,b)=>(PRIORITY[a.provider]??50)-(PRIORITY[b.provider]??50)||String(a.id).localeCompare(String(b.id)))[0];
const PROVIDERS=new Set(['steam','discord','chainlens','xbox','playstation','gog','epic']);
function reference(value){if(typeof value!=='string'||value.length>240)throw Error('Invalid friend account.');const colon=value.indexOf(':'),provider=value.slice(0,colon),id=value.slice(colon+1);if(!PROVIDERS.has(provider)||!id||!/^[a-zA-Z0-9_.-]+$/.test(id))throw Error('Invalid friend account.');return value;}
function contactGroups(accounts,groups=[],verifiedLinks=[],separated=[]){
 const splits=new Set(separated);
 const people=new Map(accounts.map(account=>[reference(account.provider+':'+account.id),account])),parent=new Map([...people.keys()].map(key=>[key,key]));
 const root=key=>{let value=key;while(parent.get(value)!==value)value=parent.get(value);return value;};
 const join=(a,b)=>{if(people.has(a)&&people.has(b))parent.set(root(b),root(a));};
 for(const group of groups)for(const member of group.slice(1))join(group[0],member);
 // Only adapters may supply these edges, after verifying stable platform IDs.
 for(const link of verifiedLinks)if(link.verified===true&&!splits.has(link.from)&&!splits.has(link.to))join(link.from,link.to);
 const result=new Map();for(const [key,account]of people){const group=root(key);if(!result.has(group))result.set(group,[]);result.get(group).push(account);}
 return [...result.values()].map(raw=>{const primary=preferred(raw),members=[primary,...raw.filter(account=>account!==primary)];return {key:members.map(account=>account.provider+':'+account.id).sort().join('|'),members};});
}
return {contactGroups,reference,preferred};
});
