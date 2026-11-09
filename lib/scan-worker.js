const { parentPort, workerData } = require('node:worker_threads');
const scanners = require('./scanners');
(async () => {
  const providers = ['steam', 'xbox', 'gog', 'epic'];
  const methods = ['scanSteamLibrary', 'scanXboxLibrary', 'scanGogLibrary', 'scanEpicLibrary'];
  const results = await Promise.allSettled(methods.map(name => scanners[name](workerData?.libraryRoots)));
  let itch;
  try{itch=require('./indie-platforms').readItchLibrary(workerData?.itchDatabase,workerData?.itchAccount);}catch(error){itch={available:false,installed:[],owned:[],message:`itch.io library could not be read: ${error.message}`};}
  let games = scanners.uniqueGames([...results.flatMap(r => r.status === 'fulfilled' ? r.value : []),...itch.installed]);
  const webRequest=require('./indie-platforms').readWavedashCatalog().catch(error=>({available:false,games:[],message:error.message}));
  if (workerData?.artDirectory) games = await require('./artwork').cacheSteamArtwork(games, workerData.artDirectory);
  if (workerData?.artDirectory) games = await require('./artwork').cacheGogArtwork(games, workerData.artDirectory);
  let owned;
  try {owned=require('./catalog').readGalaxyLibrary(workerData.galaxyDatabase,workerData.galaxyAccount);}catch(error){owned={available:false,message:`Galaxy library could not be read: ${error.message}`};}
  parentPort.postMessage({
    games,
    owned,
    itch,
    web:await webRequest,
    warnings: results.flatMap((r, i) => r.status === 'rejected' ? [`${providers[i]}: ${r.reason.message}`] : [])
  });
})();
