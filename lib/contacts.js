'use strict';
const fs=require('node:fs'),path=require('node:path');
const {contactGroups,reference}=require('../app/contact-groups');
class Contacts{
 constructor(directory){this.file=path.join(directory,'contacts.json');this.groups=[];this.splits=new Set();try{if(fs.statSync(this.file).size<1000000){const saved=JSON.parse(fs.readFileSync(this.file,'utf8')),data=Array.isArray(saved)?saved:saved.groups;if(Array.isArray(saved.splits))this.splits=new Set(saved.splits.slice(0,5000).map(reference));if(Array.isArray(data))this.groups=data.slice(0,1000).filter(row=>Array.isArray(row)&&row.length>=2&&row.length<=50).map(row=>[...new Set(row.map(reference))]);}}catch{this.groups=[];}}
 read(){return this.groups.map(row=>[...row]);}
 save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({groups:this.groups,splits:[...this.splits]}));fs.renameSync(this.file+'.tmp',this.file);return this.read();}
 merge(members){if(!Array.isArray(members)||members.length<2||members.length>50)throw Error('Choose between 2 and 50 accounts to merge.');const combined=new Set(members.map(reference));let remaining=this.groups.map(group=>[...group]),changed=true;while(changed){changed=false;remaining=remaining.filter(group=>{if(!group.some(member=>combined.has(member)))return true;for(const member of group)combined.add(member);changed=true;return false;});}if(combined.size>50)throw Error('This contact has too many accounts.');for(const member of combined)this.splits.delete(member);this.groups=[...remaining,[...combined].sort()];return this.save();}
 unmerge(member){reference(member);this.splits.add(member);this.groups=this.groups.map(group=>group.filter(item=>item!==member)).filter(group=>group.length>1);return this.save();}
}
module.exports={Contacts,contactGroups,reference};
