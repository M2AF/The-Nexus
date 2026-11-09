const test=require('node:test'),assert=require('node:assert/strict');
const {imageURL}=require('../app/rich-description');
const {mergeOffers}=require('../lib/discover');
test('Description images use approved HTTPS store hosts, rejecting executable, local and foreign sources',()=>{
 for(const value of ['https://items.gog.com/fallout_4/art.jpg','https://shared.fastly.steamstatic.com/store_item_assets/extras/animation.gif','https://images-2.gog-statics.com/art.jpg'])assert(imageURL(value));
 for(const value of ['javascript:alert(1)','data:image/svg+xml,test','file:///C:/secret.png','http://items.gog.com/art.jpg','https://items.gog.com.evil.test/x','https://user:pass@items.gog.com/a','https://items.gog.com:8080/a'])assert.equal(imageURL(value),null);
});
test('Catalog keeps bounded rich description data while compact summaries collapse markup whitespace',()=>{
 const row={provider:'steam',id:'123',title:'Test game',description:'First\n\n\n\n second',descriptionHtml:'<p>First</p><img src="https://items.gog.com/art.jpg"><p>Second</p>'};
 const game=mergeOffers([row])[0];assert.equal(game.description,'First second');assert.equal(game.descriptionHtml,row.descriptionHtml);
 assert.equal(mergeOffers([{...row,descriptionHtml:'x'.repeat(200000)}])[0].descriptionHtml.length,120000);
});
