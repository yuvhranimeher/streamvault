const VERSION='20260722-v6';
const PREFIX='streamvault-';
const SHELL=`${PREFIX}shell-${VERSION}`;
const STATIC=`${PREFIX}static-${VERSION}`;
const POSTERS=`${PREFIX}posters-${VERSION}`;
const POSTER_LIMIT=500;

const SHELL_ASSETS=[
  '/index.html','/runtime-config.js','/styles.css','/frontend-player-ui.js',
  '/frontend-playback-session.js','/app-v3.js','/details-exact-v5.js','/home.js',
  '/downloads.js','/search.js','/livetv.js','/player-runtime-v2.js','/live-fast.js',
  '/boot.js','/hostinger-poster-fix.js','/series-modal-episodes-v7.js',
  '/media-popup-polish-v8.js','/series-instant-prefetch-v9.js','/movie-play-button-v10.js',
  '/instant-remux-v23.js','/offline-ui.js','/boot-search-index.json','/channels.json',
  '/manifest.webmanifest','/fallback.webp','/assets/insomnia-tapes-logo.png'
];

const BACKEND_PREFIXES=['/api','/download','/live','/live-relay','/proxy','/stream','/subtitles','/subtitle','/audio','/hls','/playback'];
const MEDIA_RE=/\.(?:m3u8|ts|m4s|mp4|m4v|mkv|webm|mov|avi|mp3|m4a|aac|flac|wav|vtt)(?:$|\?)/i;
const STATIC_RE=/\.(?:css|js|json|webmanifest|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i;
const FRESH_CRITICAL_RE=/\/(?:runtime-config|home-snapshot-[^/]+|home)\.js$/i;

function pathMatches(path,prefix){return path===prefix||path.startsWith(prefix+'/');}
function isBackend(url){return url.hostname==='backend.streamvault.fit'||BACKEND_PREFIXES.some(p=>pathMatches(url.pathname,p));}
function isMedia(req,url){
  const accept=req.headers.get('accept')||'';
  return req.headers.has('range')||req.destination==='video'||req.destination==='audio'||/^(?:video|audio)\//i.test(accept)||MEDIA_RE.test(url.pathname);
}
function isPoster(req,url){return req.method==='GET'&&req.destination==='image'&&url.hostname==='image.tmdb.org';}
function isStatic(req,url){return req.method==='GET'&&url.origin===self.location.origin&&(url.pathname.startsWith('/assets/')||['style','script','font','image'].includes(req.destination)||STATIC_RE.test(url.pathname));}
function good(res){return !!res&&res.ok&&!String(res.headers.get('content-type')||'').toLowerCase().includes('text/html');}

async function trim(name,limit){
  const cache=await caches.open(name);const keys=await cache.keys();
  await Promise.all(keys.slice(0,Math.max(0,keys.length-limit)).map(k=>cache.delete(k)));
}

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(SHELL);
  await Promise.allSettled(SHELL_ASSETS.map(async path=>{
    try{const res=await fetch(path,{cache:'reload'});if(res.ok)await cache.put(path,res);}catch{}
  }));
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keep=new Set([SHELL,STATIC,POSTERS]);
  await Promise.all((await caches.keys()).filter(n=>n.startsWith(PREFIX)&&!keep.has(n)).map(n=>caches.delete(n)));
  await self.clients.claim();
})()));

async function networkOnly(req){return fetch(req,{cache:'no-store'});}

async function navigation(req){
  try{
    const res=await fetch(req,{cache:'no-cache'});
    if(res.ok){const cache=await caches.open(SHELL);await cache.put('/index.html',res.clone());}
    return res;
  }catch{
    return (await caches.open(SHELL)).match('/index.html')||Response.error();
  }
}

async function networkFirst(req){
  const cache=await caches.open(STATIC);
  try{
    const res=await fetch(req,{cache:'no-cache'});
    if(good(res))await cache.put(req,res.clone());
    return res;
  }catch{
    return await cache.match(req)||await caches.match(req)||Response.error();
  }
}

async function staleWhileRevalidate(event,req,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(req);
  const update=fetch(req,{cache:'no-cache'}).then(async res=>{if(good(res)||res.type==='opaque'){await cache.put(req,res.clone());if(cacheName===POSTERS)await trim(POSTERS,POSTER_LIMIT);}return res;});
  if(cached){event.waitUntil(update.catch(()=>{}));return cached;}
  return update;
}

self.addEventListener('fetch',event=>{
  const req=event.request;const url=new URL(req.url);
  if(req.method!=='GET'||isBackend(url)||isMedia(req,url)){event.respondWith(networkOnly(req));return;}
  if(req.mode==='navigate'){event.respondWith(navigation(req));return;}
  if(isPoster(req,url)){event.respondWith(staleWhileRevalidate(event,req,POSTERS));return;}
  if(url.origin===self.location.origin&&FRESH_CRITICAL_RE.test(url.pathname)){event.respondWith(networkFirst(req));return;}
  if(url.origin===self.location.origin&&['/channels.json','/boot-search-index.json','/catalog.json'].includes(url.pathname)){event.respondWith(networkFirst(req));return;}
  if(isStatic(req,url))event.respondWith(staleWhileRevalidate(event,req,STATIC));
});
