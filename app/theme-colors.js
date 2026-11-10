/* Shared, dependency-free color math for renderer previews and persisted settings. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NexusTheme=api;})(typeof globalThis==='object'?globalThis:this,()=>{
 'use strict';
 const defaults={background:'#0c1018ff',accent:'#9ae8d6ff'};
 function color(value){if(typeof value!=='string'||!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value))throw Error('Use a hex color such as #E82F51 or #E82F51FF.');return (value.length===7?value+'ff':value).toLowerCase();}
 function settings(value){if(!value||typeof value!=='object')throw Error('Choose a background and button color.');return {background:color(value.background),accent:color(value.accent)};}
 function rgb(hex){hex=color(hex);return [1,3,5,7].map(i=>parseInt(hex.slice(i,i+2),16));}
 function hex(values){return '#'+values.map(n=>Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0')).join('');}
 function mix(a,b,amount){const x=rgb(a),y=rgb(b);return hex(x.slice(0,3).map((v,i)=>v+(y[i]-v)*amount));}
 function composite(a,b){return mix(b,a,rgb(a)[3]/255);}
 function luminance(c){return rgb(c).slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
 function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 function ink(bg){return contrast('#ffffff',bg)>contrast('#000000',bg)?'#ffffff':'#000000';}
 function readable(candidate,bg){return contrast(candidate,bg)>=4.5?candidate:ink(bg);}
 function palette(value){const t=settings(value),bg=composite(t.background,defaults.background),text=ink(bg),panel=mix(bg,text,.045),accent=composite(t.accent,bg),header=mix(panel,accent,.12),hover=mix(panel,text,.08),selected=mix(panel,accent,.2);return {bg,text,panel,accent,header,hover,selected,sidebar:mix(bg,text,.02),line:mix(bg,text,.24),muted:readable(mix(bg,text,.68),bg),onAccent:ink(accent),onPanel:ink(panel),onHeader:ink(header),onHover:ink(hover),onSelected:ink(selected),accentText:readable(accent,bg),panelMuted:readable(mix(panel,ink(panel),.68),panel)};}
 function toHsv(value){const [r,g,b,a]=rgb(value).map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return {h,s:max?d/max:0,v:max,a};}
 function fromHsv({h,s,v,a=1}){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return hex([...parts.map(n=>(n+m)*255),a*255]);}
 return {defaults,color,settings,rgb,mix,composite,contrast,palette,toHsv,fromHsv};
});
