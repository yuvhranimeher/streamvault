'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, 'sw-20260722-v6.js'), 'utf8');
const origin = 'https://streamvault.fit';

function cacheKey(input) {
  return new URL(typeof input === 'string' ? input : input.url, origin).href;
}

class MemoryCache {
  constructor() { this.entries = new Map(); }
  async match(input) { return this.entries.get(cacheKey(input))?.clone(); }
  async put(input, response) { this.entries.set(cacheKey(input), response.clone()); }
  async delete(input) { return this.entries.delete(cacheKey(input)); }
  async keys() { return [...this.entries.keys()].map(url => ({ url })); }
}

const cacheMap = new Map();
const caches = {
  async open(name) {
    if (!cacheMap.has(name)) cacheMap.set(name, new MemoryCache());
    return cacheMap.get(name);
  },
  async keys() { return [...cacheMap.keys()]; },
  async delete(name) { return cacheMap.delete(name); }
};

const handlers = new Map();
let skipWaitingCalls = 0;
let claimCalls = 0;
let fetchHandler = async () => new Response('not found', { status: 404 });
const fetchCalls = [];
const self = {
  location: { origin },
  clients: { async claim() { claimCalls += 1; } },
  async skipWaiting() { skipWaitingCalls += 1; },
  addEventListener(type, handler) { handlers.set(type, handler); }
};

async function fakeFetch(request, options = {}) {
  fetchCalls.push({ url: cacheKey(request), options });
  return fetchHandler(request, options);
}

function request(url, { destination = '', headers = {}, method = 'GET', mode = 'cors' } = {}) {
  return {
    url: new URL(url, origin).href,
    destination,
    headers: new Headers(headers),
    method,
    mode
  };
}

async function dispatchFetch(req) {
  let responsePromise = null;
  const waits = [];
  handlers.get('fetch')({
    request: req,
    respondWith(value) { responsePromise = Promise.resolve(value); },
    waitUntil(value) { waits.push(Promise.resolve(value)); }
  });
  assert(responsePromise, `service worker did not handle ${req.url}`);
  const response = await responsePromise;
  await Promise.all(waits);
  return response;
}

const context = {
  self,
  caches,
  fetch: fakeFetch,
  URL,
  Request,
  Response,
  Headers,
  Set,
  Promise,
  console
};
vm.runInNewContext(source, context, { filename: 'sw-20260722-v6.js' });

(async () => {
  fetchHandler = async req => new Response(`network:${new URL(req.url).search}`, {
    status: 200,
    headers: { 'Content-Type': 'application/javascript' }
  });
  const v1 = request('/home.js?v=one', { destination: 'script' });
  const v2 = request('/home.js?v=two', { destination: 'script' });
  assert.strictEqual(await (await dispatchFetch(v1)).text(), 'network:?v=one');
  assert.strictEqual(await (await dispatchFetch(v2)).text(), 'network:?v=two');
  const versionedKeys = (await Promise.all([...cacheMap.values()].map(cache => cache.keys()))).flat().map(key => key.url);
  assert(versionedKeys.includes(`${origin}/home.js?v=one`));
  assert(versionedKeys.includes(`${origin}/home.js?v=two`));

  fetchHandler = async () => { throw new TypeError('offline'); };
  assert.strictEqual(await (await dispatchFetch(v2)).text(), 'network:?v=two');
  assert.strictEqual(await (await dispatchFetch(v1)).text(), 'network:?v=one');

  fetchHandler = async () => new Response('backend-network', { status: 200 });
  const backendResponse = await dispatchFetch(request('https://backend.streamvault.fit/api/ready'));
  assert.strictEqual(await backendResponse.text(), 'backend-network');
  assert.strictEqual(fetchCalls.at(-1).options.cache, 'no-store');

  fetchHandler = async () => new Response('range-network', {
    status: 206,
    headers: { 'Content-Range': 'bytes 0-3/10' }
  });
  const rangeResponse = await dispatchFetch(request('/movie.mp4', { headers: { Range: 'bytes=0-3' }, destination: 'video' }));
  assert.strictEqual(rangeResponse.status, 206);
  assert.strictEqual(await rangeResponse.text(), 'range-network');
  assert.strictEqual(fetchCalls.at(-1).options.cache, 'no-store');

  fetchHandler = async () => new Response('missing', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  const missing = await dispatchFetch(request('/missing.js?v=404', { destination: 'script' }));
  assert.strictEqual(missing.status, 404);
  assert.strictEqual(await missing.text(), 'missing');

  const poster = request('https://image.tmdb.org/t/p/w500/poster.jpg', { destination: 'image' });
  fetchHandler = async () => new Response('poster-good', { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
  assert.strictEqual(await (await dispatchFetch(poster)).text(), 'poster-good');
  fetchHandler = async () => { throw new TypeError('TMDB offline'); };
  assert.strictEqual(await (await dispatchFetch(poster)).text(), 'poster-good');
  fetchHandler = async () => new Response('poster-failed', { status: 503 });
  assert.strictEqual(await (await dispatchFetch(poster)).text(), 'poster-good');
  fetchHandler = async () => { throw new TypeError('TMDB offline again'); };
  assert.strictEqual(await (await dispatchFetch(poster)).text(), 'poster-good', 'failed poster response replaced the valid cached poster');

  await caches.open('streamvault-obsolete-cache');
  await caches.open('unrelated-cache');
  const activationWaits = [];
  handlers.get('activate')({ waitUntil(value) { activationWaits.push(Promise.resolve(value)); } });
  await Promise.all(activationWaits);
  assert(!(await caches.keys()).includes('streamvault-obsolete-cache'));
  assert((await caches.keys()).includes('unrelated-cache'));
  assert.strictEqual(claimCalls, 1);

  fetchHandler = async () => new Response('not found', { status: 404 });
  const installWaits = [];
  handlers.get('install')({ waitUntil(value) { installWaits.push(Promise.resolve(value)); } });
  await Promise.all(installWaits);
  assert.strictEqual(skipWaitingCalls, 1);

  console.log('Service-worker caching tests passed: exact query keys, network-only media/API, durable posters, real 404s');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
