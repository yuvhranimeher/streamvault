const CACHE_VERSION = '20260713-hostinger-frontend-v3';
const CACHE_PREFIX = 'streamvault-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;
const POSTER_CACHE = `${CACHE_PREFIX}posters-${CACHE_VERSION}`;
const POSTER_CACHE_LIMIT = 300;

const SHELL_ASSETS = [
  '/index.html',
  '/runtime-config.js',
  '/styles.css',
  '/fifa-fast.js',
  '/app-v3.js',
  '/details-exact-v5.js',
  '/home.js',
  '/downloads.js',
  '/search.js',
  '/livetv.js',
  '/player.js',
  '/live-fast.js',
  '/boot.js',
  '/hostinger-poster-fix.js',
  '/series-modal-episodes-v7.js',
  '/media-popup-polish-v8.js',
  '/series-instant-prefetch-v9.js',
  '/movie-play-button-v10.js',
  '/instant-remux-v23.js',
  '/offline-ui.js',
  '/home-feed.json',
  '/boot-search-index.json',
  '/channels.json',
  '/manifest.webmanifest',
  '/fallback.webp',
  '/assets/insomnia-tapes-logo.png',
  '/copyright.html',
  '/disclaimer.html',
  '/legal.html',
  '/privacy.html',
  '/terms.html'
];

const STATIC_FILE_PATTERN = /\.(?:css|js|json|webmanifest|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i;
const MEDIA_FILE_PATTERN = /\.(?:m3u8|ts|m4s|mp4|m4v|mkv|webm|mov|avi|mp3|m4a|aac|flac|wav|vtt)(?:$|\?)/i;
const BACKEND_PATHS = ['/api', '/download', '/live', '/live-relay', '/proxy', '/stream', '/subtitles'];
const NEVER_CACHE_PATHS = ['/api/heavy-compat-hls', '/api/mobile-hls', '/api/ftp/stream'];
const STATIC_JSON_PATHS = new Set(['/home-feed.json', '/boot-search-index.json', '/channels.json', '/catalog.json']);

function successful(response){
  return Boolean(response && response.ok);
}

function htmlResponse(response){
  const contentType=response?.headers?.get('content-type') || '';
  return successful(response) && contentType.toLowerCase().includes('text/html');
}

function cacheableStatic(response){
  return successful(response) && !htmlResponse(response);
}

function cacheablePoster(response){
  return Boolean(response && (response.ok || response.type === 'opaque'));
}

function pathMatches(pathname,prefix){
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

function isBackendRequest(url){
  return url.hostname === 'backend.streamvault.fit'
    || BACKEND_PATHS.some(prefix=>pathMatches(url.pathname,prefix));
}

function isMediaRequest(request,url){
  const accept=request.headers.get('accept') || '';
  return request.headers.has('range')
    || request.destination === 'video'
    || request.destination === 'audio'
    || /^(?:video|audio)\//i.test(accept)
    || MEDIA_FILE_PATTERN.test(url.pathname)
    || NEVER_CACHE_PATHS.some(prefix=>pathMatches(url.pathname,prefix));
}

function isPosterRequest(request,url){
  return request.method === 'GET'
    && request.destination === 'image'
    && url.hostname === 'image.tmdb.org';
}

function isStaticRequest(request,url){
  if(url.origin !== self.location.origin || request.method !== 'GET')return false;
  if(url.pathname.startsWith('/assets/'))return true;
  return ['style','script','font','image'].includes(request.destination)
    || STATIC_FILE_PATTERN.test(url.pathname);
}

function staticCacheKey(url){
  return new Request(`${url.origin}${url.pathname}`);
}

async function trimCache(cacheName,limit){
  const cache=await caches.open(cacheName);
  const keys=await cache.keys();
  if(keys.length <= limit)return;
  await Promise.all(keys.slice(0,keys.length-limit).map(key=>cache.delete(key)));
}

async function cacheShellAsset(cache,path){
  try{
    const response=await fetch(new Request(path,{cache:'reload'}));
    const canCache=path.endsWith('.html') ? htmlResponse(response) : cacheableStatic(response);
    if(canCache)await cache.put(path,response);
  }catch(_error){
    // A later successful request can populate an asset unavailable during install.
  }
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL_ASSETS.map(path=>cacheShellAsset(cache,path)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    const current=new Set([SHELL_CACHE,STATIC_CACHE,POSTER_CACHE]);
    await Promise.all(names
      .filter(name=>name.startsWith(CACHE_PREFIX) && !current.has(name))
      .map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkOnly(request){
  return fetch(request,{cache:'no-store'});
}

async function navigationNetworkFirst(request){
  const url=new URL(request.url);
  let networkResponse;
  try{
    networkResponse=await fetch(request,{cache:'no-cache'});
    if(htmlResponse(networkResponse)){
      const cache=await caches.open(SHELL_CACHE);
      const key=url.pathname === '/' ? '/index.html' : url.pathname;
      await cache.put(key,networkResponse.clone());
      return networkResponse;
    }
    if(successful(networkResponse))return networkResponse;
  }catch(_error){
    // Fall through to the verified Hostinger shell.
  }

  const cache=await caches.open(SHELL_CACHE);
  const exact=await cache.match(url.pathname === '/' ? '/index.html' : url.pathname);
  if(htmlResponse(exact))return exact;
  const index=await cache.match('/index.html');
  if(htmlResponse(index))return index;
  return networkResponse || Response.error();
}

async function jsonNetworkFirst(request,url){
  const cache=await caches.open(STATIC_CACHE);
  const key=staticCacheKey(url);
  try{
    const response=await fetch(request,{cache:'no-cache'});
    if(cacheableStatic(response)){
      await cache.put(key,response.clone());
      return response;
    }
    const cached=await cache.match(key) || await caches.match(key);
    return cached || response;
  }catch(_error){
    const cached=await cache.match(key) || await caches.match(key);
    return cached || Response.error();
  }
}

async function staticStaleWhileRevalidate(event,request,url){
  const cache=await caches.open(STATIC_CACHE);
  const key=staticCacheKey(url);
  const cached=await cache.match(key) || await caches.match(key);
  const update=fetch(request,{cache:'no-cache'})
    .then(async response=>{
      if(cacheableStatic(response))await cache.put(key,response.clone());
      return response;
    });
  if(cached){
    event.waitUntil(update.catch(()=>{}));
    return cached;
  }
  return update;
}

async function posterStaleWhileRevalidate(event,request){
  const cache=await caches.open(POSTER_CACHE);
  const cached=await cache.match(request);
  const update=fetch(request)
    .then(async response=>{
      if(cacheablePoster(response)){
        await cache.put(request,response.clone());
        await trimCache(POSTER_CACHE,POSTER_CACHE_LIMIT);
      }
      return response;
    });
  if(cached){
    event.waitUntil(update.catch(()=>{}));
    return cached;
  }
  return update;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);

  if(request.method !== 'GET' || isMediaRequest(request,url) || isBackendRequest(url)){
    event.respondWith(networkOnly(request));
    return;
  }

  if(request.mode === 'navigate'){
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  if(isPosterRequest(request,url)){
    event.respondWith(posterStaleWhileRevalidate(event,request));
    return;
  }

  if(url.origin === self.location.origin && STATIC_JSON_PATHS.has(url.pathname)){
    event.respondWith(jsonNetworkFirst(request,url));
    return;
  }

  if(isStaticRequest(request,url)){
    event.respondWith(staticStaleWhileRevalidate(event,request,url));
  }
});
