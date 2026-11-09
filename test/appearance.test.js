const test=require('node:test'),assert=require('node:assert/strict');
const {LOGOS,logoChoice,logoSettings}=require('../lib/appearance');
test('Logo settings separate three safe colors from animation',()=>{
 assert.equal(Object.keys(LOGOS).length,3);
 for(const variant of ['blue','orange','pink']){assert.equal(logoChoice(variant),variant);for(const animated of [false,true])assert.deepEqual(logoSettings({logoVariant:variant,logoAnimated:animated}),{logoVariant:variant,logoAnimated:animated});}
 for(const value of ['constructor','__proto__','../../secret.png','https://example.com/logo.png',null,{}])assert.throws(()=>logoChoice(value));
 assert.throws(()=>logoSettings({logoVariant:'pink',logoAnimated:'yes'}));
});
