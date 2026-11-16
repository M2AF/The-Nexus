'use strict';
const LIBRARY_STORES=['steam','xbox','gog','epic','battlenet','itch','wavedash','custom'];
function libraryStores(value){if(!Array.isArray(value)||value.length>LIBRARY_STORES.length||value.some(store=>typeof store!=='string'||!LIBRARY_STORES.includes(store)))throw Error('Choose valid library stores.');return [...new Set(value)];}
module.exports={LIBRARY_STORES,libraryStores};
