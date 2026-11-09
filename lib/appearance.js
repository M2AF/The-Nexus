'use strict';
const LOGOS={blue:{label:'Blue / cyan',file:'branding/blue.png'},orange:{label:'Orange',file:'branding/orange.png'},pink:{label:'Pink',file:'branding/pink.png'}};
function logoChoice(value){if(typeof value!=='string'||!Object.hasOwn(LOGOS,value))throw Error('Choose an available logo color.');return value;}
function logoSettings(value){if(typeof value==='string')return {logoVariant:logoChoice(value)};if(!value||typeof value!=='object'||typeof value.logoAnimated!=='boolean')throw Error('Choose a logo color and animation setting.');return {logoVariant:logoChoice(value.logoVariant),logoAnimated:value.logoAnimated};}
module.exports={LOGOS,logoChoice,logoSettings};
