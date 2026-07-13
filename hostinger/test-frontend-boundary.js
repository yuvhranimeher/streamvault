const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const runtimeSource = fs.readFileSync(path.join(ROOT, 'runtime-config.js'), 'utf8');
const offlineSource = fs.readFileSync(path.join(ROOT, 'offline-ui.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw-20260714-v4.js'), 'utf8');
const fallbackSw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const homeFeed = JSON.parse(fs.readFileSync(path.join(ROOT, 'home-feed.json'), 'utf8'));
const channels = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels.json'), 'utf8'));

const fetchCalls = [];
const listeners = new Map();
const clickListeners = [];
const toastMessages = [];
let playbackCalls = 0;
let liveCalls = 0;

function payloadFor(url) {
  const pathname = new URL(String(url), 'https://streamvault.fit').pathname;
  if (pathname === '/home-feed.json') return homeFeed;
  if (pathname === '/channels.json') return channels;
  if (pathname === '/api/version') return { version: 'boundary-test' };
  return {};
}

async function fakeFetch(input) {
  const url = typeof input === 'string' ? input : input.url;
  fetchCalls.push(String(url));
  return {
    ok: true,
    status: 200,
    json: async () => payloadFor(url)
  };
}

function addListener(type, handler) {
  const handlers = listeners.get(type) || [];
  handlers.push(handler);
  listeners.set(type, handlers);
}

const document = {
  documentElement: { dataset: {} },
  addEventListener(type, handler, capture) {
    if (type === 'click') clickListeners.push({ handler, capture });
    else addListener(type, handler);
  }
};

function XMLHttpRequest() {}
XMLHttpRequest.prototype.open = function open(_method, url) {
  this.openedUrl = url;
};

class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

const window = {
  location: new URL('https://streamvault.fit/'),
  fetch: fakeFetch,
  XMLHttpRequest,
  setTimeout,
  clearTimeout,
  addEventListener: addListener,
  dispatchEvent(event) {
    for (const handler of listeners.get(event.type) || []) handler(event);
  },
  showToast(message) { toastMessages.push(message); },
  playMedia() { playbackCalls += 1; },
  playFtpMedia() { playbackCalls += 1; },
  playSeriesEpisode() { playbackCalls += 1; },
  playMovieFromDetail() { playbackCalls += 1; },
  playMediaModalPrimary() { playbackCalls += 1; },
  openLiveChannel() { liveCalls += 1; },
  openLiveMatchChannel() { liveCalls += 1; }
};

const context = {
  window,
  document,
  navigator: {},
  URL,
  Request,
  AbortController,
  CustomEvent,
  console,
  setTimeout,
  clearTimeout
};

vm.runInNewContext(runtimeSource, context, { filename: 'runtime-config.js' });

(async () => {
  await Promise.all([
    window.STREAMVAULT_CONFIG.staticData.homeFeed,
    window.STREAMVAULT_CONFIG.staticData.channels,
    window.__svBackendCheckPromise
  ]);

  assert.strictEqual(
    window.STREAMVAULT_CONFIG.backendUrl('/api/movies?page=1'),
    'https://backend.streamvault.fit/api/movies?page=1'
  );
  assert.strictEqual(
    window.STREAMVAULT_CONFIG.backendUrl('/download/example'),
    'https://backend.streamvault.fit/download/example'
  );
  assert.strictEqual(
    window.STREAMVAULT_CONFIG.backendUrl('/styles.css'),
    '/styles.css'
  );

  await window.fetch('/api/movies?page=0');
  await window.fetch('/home-feed.json');
  assert(fetchCalls.includes('https://backend.streamvault.fit/api/movies?page=0'));
  assert(fetchCalls.includes('/home-feed.json'));

  const xhr = new window.XMLHttpRequest();
  xhr.open('GET', '/api/channels');
  assert.strictEqual(xhr.openedUrl, 'https://backend.streamvault.fit/api/channels');

  window.STREAMVAULT_CONFIG.backendStatus.available = false;
  vm.runInNewContext(offlineSource, context, { filename: 'offline-ui.js' });
  window.playMedia('movie-id');
  window.openLiveChannel('channel-id');
  assert.strictEqual(playbackCalls, 0);
  assert.strictEqual(liveCalls, 0);
  assert(toastMessages.includes('Playback server is currently offline.'));
  assert(toastMessages.includes('Live TV server is currently offline.'));

  const firstScript = index.match(/<script[^>]+src=["']([^"']+)/)?.[1] || '';
  assert(firstScript.startsWith('/runtime-config.js'));
  assert(index.includes('/manifest.webmanifest'));
  assert(index.includes('/offline-ui.js'));
  assert(runtimeSource.includes("navigator.serviceWorker.register('/sw-20260714-v4.js'"));
  assert(runtimeSource.includes("updateViaCache: 'none'"));

  const artwork = [
    ...(homeFeed.hero || []),
    ...(homeFeed.rows || []).flatMap(row => row.items || [])
  ].flatMap(item => [item.poster, item.backdrop]).filter(Boolean);
  assert(!artwork.some(url => /backend\.streamvault\.fit|\/poster-cache(?:\?|$)|\/image-proxy(?:\?|$)/i.test(String(url))));

  for (const channel of channels) {
    if (!channel.logo?.startsWith('/')) continue;
    const logo = channel.logo.split(/[?#]/, 1)[0].slice(1);
    assert(fs.existsSync(path.join(ROOT, logo)), `missing channel logo: ${logo}`);
  }

  assert(sw.includes("request.headers.has('range')"));
  assert(sw.includes("request.destination === 'video'"));
  assert(sw.includes("request.destination === 'audio'"));
  assert(sw.includes("'/api/heavy-compat-hls'"));
  assert(sw.includes("'/api/mobile-hls'"));
  assert(sw.includes('POSTER_CACHE_LIMIT'));
  assert.strictEqual(fallbackSw.replace(/\r\n/g, '\n'), sw.replace(/\r\n/g, '\n'));

  console.log(`Hostinger frontend boundary tests passed: ${artwork.length} static artwork URLs, ${channels.length} local channel logos`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
