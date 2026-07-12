const CACHE_NAME = 'streamvault-shell-20260712-v2';
const CACHE_PREFIX = 'streamvault-';

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
  '/home-feed.json',
  '/boot-search-index.json',
  '/fallback.webp',
  '/assets/insomnia-tapes-logo.png'
];

const STATIC_FILE_PATTERN = /\.(?:css|js|json|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i;

function isSuccessful(response) {
  return Boolean(response && response.ok);
}

function isHtml(response) {
  const contentType = response.headers.get('content-type') || '';
  return isSuccessful(response) && contentType.toLowerCase().includes('text/html');
}

function isCacheableStatic(response) {
  return isSuccessful(response) && !isHtml(response);
}

function isBackendRequest(url) {
  const backendPaths = ['/api', '/live', '/live-relay', '/stream', '/subtitles'];
  return url.hostname === 'backend.streamvault.fit' || backendPaths.some(path =>
    url.pathname === path || url.pathname.startsWith(path + '/')
  );
}

function isStaticRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/assets/')) return true;
  return ['style', 'script', 'font', 'image'].includes(request.destination) ||
    STATIC_FILE_PATTERN.test(url.pathname);
}

function staticCacheKey(url) {
  return new Request(`${url.origin}${url.pathname}`);
}

async function cacheShellAsset(cache, path) {
  try {
    const response = await fetch(new Request(path, { cache: 'reload' }));
    const canCache = path === '/index.html'
      ? isHtml(response)
      : isCacheableStatic(response);
    if (canCache) {
      await cache.put(path, response);
    }
  } catch (_) {
    // A later successful request can populate an asset that was unavailable at install time.
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_ASSETS.map(path => cacheShellAsset(cache, path)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

async function networkOnly(request) {
  return fetch(request, { cache: 'no-store' });
}

async function navigationNetworkFirst(request) {
  let networkResponse;

  try {
    networkResponse = await fetch(request, { cache: 'no-cache' });
    if (isHtml(networkResponse)) {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/' || pathname === '/index.html') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put('/index.html', networkResponse.clone());
      }
      return networkResponse;
    }

    if (isSuccessful(networkResponse)) return networkResponse;
  } catch (_) {
    // Use the verified app shell below when the network is unavailable.
  }

  const cache = await caches.open(CACHE_NAME);
  const cachedIndex = await cache.match('/index.html');
  if (isHtml(cachedIndex)) return cachedIndex;

  return networkResponse || Response.error();
}

async function staticCacheFirst(request, url) {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = staticCacheKey(url);
  const cachedResponse = await cache.match(cacheKey);
  if (isCacheableStatic(cachedResponse)) return cachedResponse;

  const networkResponse = await fetch(request);
  if (isCacheableStatic(networkResponse)) {
    await cache.put(cacheKey, networkResponse.clone());
  }
  return networkResponse;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (isBackendRequest(url)) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  if (request.method === 'GET' && isStaticRequest(request, url)) {
    event.respondWith(staticCacheFirst(request, url));
  }
});
