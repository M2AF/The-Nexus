const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../app/theme-colors');
test('Theme input accepts only bounded hex colors, including opacity',()=>{
 assert.deepEqual(T.settings({background:'#ABCDEF',accent:'#12345678'}),{background:'#abcdefff',accent:'#12345678'});
 for(const value of ['red','#fff','#123456;url(x)','var(--bg)',null,{},'#GGGGGG'])assert.throws(()=>T.color(value));
});
test('Theme text remains readable across dark, light, saturated and translucent colors',()=>{
 const colors=['#000000','#ffffff','#808080','#ff0000','#00ff00','#0000ff','#e82f51','#ff9000','#9ae8d6','#ffffff00','#ffffff80'];
 for(const background of colors)for(const accent of colors){const p=T.palette({background,accent});for(const [ink,surface] of [[p.text,p.bg],[p.muted,p.bg],[p.onPanel,p.panel],[p.panelMuted,p.panel],[p.onHeader,p.header],[p.onAccent,p.accent],[p.accentText,p.bg],[p.onSelected,p.selected]])assert(T.contrast(ink,surface)>=4.5,`${ink} on ${surface}`);}
});
test('HSV controls preserve selected colors and alpha, including hue wrap and gray',()=>{
 for(const value of ['#e82f51ff','#00ff0080','#00000000','#ffffff99','#808080ff','#0000ffff'])assert.equal(T.fromHsv(T.toHsv(value)),value);
 assert.equal(T.fromHsv({h:0,s:1,v:1,a:1}),'#ff0000ff');
});
