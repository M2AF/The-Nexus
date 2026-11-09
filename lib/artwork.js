const fs = require('node:fs');
const path = require('node:path');
async function cacheSteamArtwork(games, directory) {
  fs.mkdirSync(directory, { recursive: true });
  const jobs = games.filter(g => g.provider === 'steam' && /^\d+$/.test(g.appId)).flatMap(game => ['portrait','header'].map(kind => ({game,kind})));
  async function next() {
    while (jobs.length) {
      const {game,kind} = jobs.shift();
      if (game[kind+'Path'] && fs.existsSync(game[kind+'Path'])) continue;
      const file = path.join(directory, `${game.appId}-${kind}.jpg`);
      if (fs.existsSync(file)) { game[kind+'Path'] = file; continue; }
      for (const host of ['cdn.cloudflare.steamstatic.com','shared.fastly.steamstatic.com']) {
        try {
          const asset = kind === 'portrait' ? 'library_600x900.jpg' : 'header.jpg';
          const response = await fetch(`https://${host}/steam/apps/${game.appId}/${asset}`, {signal:AbortSignal.timeout(8000)});
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) continue;
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length > 5e6 || bytes[0] !== 0xff || bytes[1] !== 0xd8) continue;
          fs.writeFileSync(file, bytes); game[kind+'Path'] = file; break;
        } catch { /* Offline or absent artwork: retain the title card. */ }
      }
    }
  }
  await Promise.all(Array.from({length:4},next)); return games;
}
async function cacheGogArtwork(games,directory) {
  for (const game of games.filter(g => g.provider === 'gog' && /^\d+$/.test(g.id))) {
    const file = path.join(directory,`gog-${game.id}.jpg`);
    const portraitFile = path.join(directory,`gog-${game.id}-portrait.jpg`);
    try {
      if (!fs.existsSync(portraitFile)) {
        try {
          const response=await fetch(`https://catalog.gog.com/v1/catalog?query=${encodeURIComponent(game.name)}&limit=10`,{signal:AbortSignal.timeout(5000)});
          const catalog=response.ok ? await response.json() : {};
          const product=catalog.products?.find(product=>String(product.id)===game.id);
          if (product?.coverVertical) {
            const url=new URL(product.coverVertical);
            if(url.protocol==='https:' && /^(images|images-\d)\.gog-statics\.com$/.test(url.hostname)) {
              const response=await fetch(url,{signal:AbortSignal.timeout(5000)});
              if(response.ok) {const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<5e6 && bytes[0]===0xff && bytes[1]===0xd8)fs.writeFileSync(portraitFile,bytes);}
            }
          }
        } catch { /* Exact catalog match unavailable; use product imagery below. */ }
      }
      if (!fs.existsSync(file)) {
        const response = await fetch(`https://api.gog.com/products/${game.id}?expand=images`,{signal:AbortSignal.timeout(5000)});
        if (!response.ok) continue;
        const product = await response.json();
        const url = new URL(product.images?.background,'https://api.gog.com');
        if (url.protocol !== 'https:' || !/^images-\d\.gog-statics\.com$/.test(url.hostname)) continue;
        const image = await fetch(url,{signal:AbortSignal.timeout(5000)}); if (!image.ok) continue;
        const bytes = Buffer.from(await image.arrayBuffer());
        if (bytes.length > 5e6 || bytes[0] !== 0xff || bytes[1] !== 0xd8) continue;
        fs.writeFileSync(file,bytes);
      }
      game.portraitPath = fs.existsSync(portraitFile) ? portraitFile : file; game.headerPath = file;
    } catch { /* Keep the title card when the official artwork is unavailable. */ }
  }
  return games;
}
module.exports = {cacheSteamArtwork,cacheGogArtwork};
