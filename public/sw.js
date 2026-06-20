const SV_CACHE_VERSION = '20260619-fifa-ui11';
const SV_POSTER_CACHE = `streamvault-posters-${SV_CACHE_VERSION}`;
const SV_ASSET_CACHE = `streamvault-assets-${SV_CACHE_VERSION}`;
const SV_API_CACHE = `streamvault-api-${SV_CACHE_VERSION}`;
const SV_HOME_FEED_TTL = 60 * 1000;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SV_POSTER_CACHE, SV_ASSET_CACHE, SV_API_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('streamvault-') && !keep.has(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  return sameOrigin(url) && /\.(?:js|css)$/i.test(url.pathname);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function brieflyCachedHomeFeed(request) {
  const cache = await caches.open(SV_API_CACHE);
  const cached = await cache.match(request);
  const cachedAt = Number(cached?.headers.get('x-sv-cached-at') || 0);
  if (cached && cachedAt && Date.now() - cachedAt < SV_HOME_FEED_TTL) return cached;

  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const headers = new Headers(fresh.headers);
      headers.set('x-sv-cached-at', String(Date.now()));
      const copy = new Response(await fresh.clone().blob(), {
        status: fresh.status,
        statusText: fresh.statusText,
        headers
      });
      cache.put(request, copy.clone());
    }
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function networkOnly(request) {
  return fetch(new Request(request, { cache: 'no-store' }));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!sameOrigin(url)) return;

  // Subtitle files must always bypass service-worker caches.
  if (url.pathname.startsWith('/subtitles/') || url.pathname.startsWith('/api/ftp/subtitle/')) return;

  if (url.pathname === '/poster-cache') {
    event.respondWith(cacheFirst(request, SV_POSTER_CACHE));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, SV_ASSET_CACHE));
    return;
  }

  if (url.pathname === '/api/fifa-live' || url.pathname === '/api/fifa-live/news' || url.pathname.startsWith('/api/fifa-live/match/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (url.pathname === '/api/home-feed') {
    event.respondWith(brieflyCachedHomeFeed(request));
  }
});
