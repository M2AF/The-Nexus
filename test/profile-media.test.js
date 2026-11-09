const test=require('node:test'),assert=require('node:assert/strict');
const {avatarUrl}=require('../app/profile-media');
test('ChainLens avatars accept saved NFT/media hosts and uploaded raster photos',()=>{
 for(const value of ['https://res.cloudinary.com/chainlens/image/upload/nft.webp','https://nft-cdn.example/selected.png','https://cdn.discordapp.com/avatars/1/a.png','data:image/png;base64,aGVsbG8=','data:image/jpeg;base64,/9j/AA=='])assert.equal(avatarUrl(value),value);
 for(const value of ['javascript:alert(1)','file:///C:/secret.png','http://example.com/p.png','https://user:password@example.com/p.png','data:image/svg+xml;base64,PHN2Zz4=','data:text/html;base64,aGVsbG8=','data:image/png;base64,<script>','data:image/png;base64,'+'A'.repeat(3*1024*1024),null])assert.equal(avatarUrl(value),null);
});
