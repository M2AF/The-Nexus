(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NexusSameGame=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const normalized=value=>String(value||'').replace(/[™®]/g,'').normalize('NFKC').replace(/^playing\s+/i,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 function isPlaying(friend){return friend.online!==false&&!!(friend.playing||friend.gameId);}
 function sameGame(friend,game){if(!game||!isPlaying(friend))return false;if(friend.provider==='steam'&&game.provider==='steam'&&friend.gameId&&game.id)return String(friend.gameId)===String(game.id);return !!normalized(game.name)&&!!friend.playing&&normalized(friend.playing)===normalized(game.name);}
 return {sameGame,isPlaying};
});
