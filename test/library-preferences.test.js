const test=require('node:test'),assert=require('node:assert/strict');
const {LIBRARY_STORES,libraryStores}=require('../lib/library-preferences');
test('Library store toggles accept independent provider combinations, including none, without arbitrary sources',()=>{
 assert.deepEqual(libraryStores([]),[]);assert.deepEqual(libraryStores(['steam','gog','steam']),['steam','gog']);assert.equal(LIBRARY_STORES.length,8);
 for(const value of [null,{},'steam',['constructor'],['__proto__'],['https://example.com'],[1]])assert.throws(()=>libraryStores(value));
});
