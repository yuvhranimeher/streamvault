const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'hostinger', 'app-v3.js'), 'utf8');
const artworkStart = appSource.indexOf('function svModalArtworkMediaKey');
const artworkEnd = appSource.indexOf('function svCurrentBrowseState', artworkStart);
assert(artworkStart >= 0 && artworkEnd > artworkStart, 'v2 modal artwork core is missing');
const artworkCore = appSource.slice(artworkStart, artworkEnd);

function createHarness() {
  let now = 100000;
  const calls = [];
  const pending = new Map();
  let behavior = url => ({
    width: url.includes('/w780/') ? 780 : 1280,
    height: url.includes('/w780/') ? 1170 : 720
  });

  class FakeImage {
    set src(url) {
      this._url = url;
      this._behavior = behavior(url, calls.filter(value => value === url).length);
      calls.push(url);
      if (this._behavior.defer) {
        pending.set(url, this);
        return;
      }
      queueMicrotask(() => this.finish());
    }

    get src() {
      return this._url;
    }

    decode() {
      return this._behavior.decodeReject
        ? Promise.reject(new Error('decode failed'))
        : Promise.resolve();
    }

    finish() {
      if (this._behavior.error) {
        this.onerror?.(new Error('image failed'));
        return;
      }
      this.naturalWidth = this._behavior.width;
      this.naturalHeight = this._behavior.height;
      this.onload?.();
    }
  }

  const window = {};
  const modal = { classList: { contains: () => false } };
  const DateShim = class extends Date {};
  DateShim.now = () => now;
  const context = {
    URL,
    Image: FakeImage,
    Date: DateShim,
    window,
    console,
    currentMediaModalItem: null,
    svModalArtworkToken: 0,
    svModalPreloadActive: 0,
    svModalArtworkPreviewCache: new Map(),
    svModalArtworkHdCache: new Map(),
    svModalArtworkFailureCache: new Map(),
    svModalArtworkDecodeCache: new Map(),
    svModalArtworkDimensionsCache: new Map(),
    svModalPreloadQueue: [],
    SV_MODAL_ARTWORK_CACHE_LIMIT: 80,
    SV_MODAL_PRELOAD_LIMIT: 2,
    SV_MODAL_ARTWORK_RETRY_COOLDOWN_MS: 15000,
    cleanDisplayTitle: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    imageFallbackData: title => `fallback:${title}`,
    svTrimMap(map, limit) {
      while (map.size > limit) map.delete(map.keys().next().value);
    },
    requestAnimationFrame: callback => callback(),
    document: {
      getElementById: id => id === 'mediaModal' ? modal : null
    }
  };
  vm.createContext(context);
  vm.runInContext(artworkCore, context);

  return {
    context,
    calls,
    pending,
    setBehavior(next) {
      behavior = next;
    },
    advance(ms) {
      now += ms;
    },
    reset() {
      context.svModalArtworkToken = 0;
      context.currentMediaModalItem = null;
      context.window.__svPendingModalArtworkPreview = null;
      for (const map of [
        context.svModalArtworkPreviewCache,
        context.svModalArtworkHdCache,
        context.svModalArtworkFailureCache,
        context.svModalArtworkDecodeCache,
        context.svModalArtworkDimensionsCache
      ]) map.clear();
      calls.length = 0;
      pending.clear();
    }
  };
}

function fakeClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    toggle(name, force) {
      if (force === undefined) force = !values.has(name);
      if (force) values.add(name);
      else values.delete(name);
      return force;
    },
    contains: name => values.has(name)
  };
}

function fakePreview() {
  const hero = {
    classList: fakeClassList(),
    style: {
      values: new Map(),
      setProperty(name, value) {
        this.values.set(name, value);
      }
    }
  };
  return {
    dataset: {},
    style: {},
    classList: fakeClassList(),
    poster: '',
    isConnected: true,
    closest: selector => selector === '.hero-section' ? hero : null,
    hero
  };
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}

(async () => {
  const h = createHarness();
  const c = h.context;

  const lowPreview = {
    id: 'movie-low-preview',
    name: 'Low Preview',
    backdrop: 'https://image.tmdb.org/t/p/w300/low-preview.jpg',
    poster: 'https://image.tmdb.org/t/p/w342/low-poster.jpg'
  };
  const preview = fakePreview();
  c.currentMediaModalItem = lowPreview;
  c.svApplyMediaModalArtwork(preview, lowPreview, 'movie', lowPreview);
  assert(preview.poster.includes('/w300/'), 'modal must paint the available preview synchronously');
  assert(['preview', 'resolving'].includes(preview.dataset.artworkState), 'preview must not be marked final');
  await flush();
  assert(preview.poster.includes('/w1280/'), 'low-resolution backdrop must upgrade to w1280');
  assert(preview.poster.includes('sv-modal-hd=v2'), 'HD TMDB request must bypass the poster cache');
  assert.strictEqual(preview.dataset.artworkState, 'decoded-hd');
  assert.strictEqual(c.svModalArtworkPreviewCache.size, 1, 'preview cache must be separate');
  assert.strictEqual(c.svModalArtworkHdCache.size, 1, 'verified HD cache must be populated');

  const reopened = fakePreview();
  c.svApplyMediaModalArtwork(reopened, lowPreview, 'movie', lowPreview);
  assert(reopened.poster.includes('/w1280/'), 'verified HD cache must display instantly on reopen');
  assert.strictEqual(reopened.dataset.artworkState, 'decoded-hd');

  assert(c.svModalHdArtworkUrl('https://image.tmdb.org/t/p/w300/a.jpg', 'backdrop', 'backdrop').includes('/w1280/'));
  assert(c.svModalHdArtworkUrl('https://image.tmdb.org/t/p/w500/a.jpg', 'backdrop', 'backdrop').includes('/w1280/'));
  assert(c.svModalHdArtworkUrl('https://image.tmdb.org/t/p/w500/a.jpg', 'poster', 'poster').includes('/w780/'));
  assert.strictEqual(
    c.svModalHdArtworkUrl('https://images.example.com/w300/a.jpg', 'backdrop', 'backdrop'),
    'https://images.example.com/w300/a.jpg',
    'unrelated external URLs must remain unchanged'
  );

  h.reset();
  c.svModalArtworkDimensionsCache.set('landscape-min', { width: 1000, height: 500 });
  c.svModalArtworkDimensionsCache.set('landscape-small', { width: 999, height: 500 });
  c.svModalArtworkDimensionsCache.set('poster-min', { width: 650, height: 975 });
  assert(c.svModalArtworkValidation('landscape-min', 'backdrop', 'backdrop').valid);
  assert(!c.svModalArtworkValidation('landscape-small', 'backdrop', 'backdrop').valid);
  assert(c.svModalArtworkValidation('poster-min', 'backdrop', 'poster').valid);

  h.reset();
  h.setBehavior(() => ({ width: 800, height: 450 }));
  const small = { id: 'small-image', backdrop: 'https://cdn.example.com/small.jpg' };
  assert.strictEqual(await c.svResolveVerifiedModalArtwork(small, 'movie', 'backdrop'), null);
  assert.strictEqual(c.svModalArtworkHdCache.size, 0, 'small image must not enter verified cache');

  h.reset();
  h.setBehavior(url => ({
    width: url.includes('/w780/') ? 780 : 1280,
    height: url.includes('/w780/') ? 1170 : 720,
    decodeReject: true
  }));
  const decodeFailure = {
    id: 'decode-failure',
    backdrop: 'https://image.tmdb.org/t/p/w500/decode.jpg'
  };
  const decodeResult = await c.svResolveVerifiedModalArtwork(decodeFailure, 'movie', 'backdrop');
  assert(decodeResult && decodeResult.state === 'decoded-hd', 'decode rejection after load must fall back safely');

  h.reset();
  let retryAttempt = 0;
  h.setBehavior(() => {
    retryAttempt += 1;
    return retryAttempt === 1 ? { error: true } : { width: 1280, height: 720 };
  });
  const retryItem = { id: 'retry-image', backdrop: 'https://cdn.example.com/retry.jpg' };
  assert.strictEqual(await c.svResolveVerifiedModalArtwork(retryItem, 'movie', 'backdrop'), null);
  assert.strictEqual(h.calls.length, 1);
  assert.strictEqual(await c.svResolveVerifiedModalArtwork(retryItem, 'movie', 'backdrop'), null);
  assert.strictEqual(h.calls.length, 1, 'failed HD request must respect cooldown');
  h.advance(15001);
  assert(await c.svResolveVerifiedModalArtwork(retryItem, 'movie', 'backdrop'));
  assert.strictEqual(h.calls.length, 2, 'failed HD request must retry after cooldown');

  h.reset();
  h.setBehavior(url => ({ width: 1280, height: 720, defer: true, url }));
  const itemA = { id: 'stale-a', backdrop: 'https://image.tmdb.org/t/p/w500/a.jpg' };
  const itemB = { id: 'stale-b', backdrop: 'https://image.tmdb.org/t/p/w500/b.jpg' };
  const stalePreview = fakePreview();
  c.currentMediaModalItem = itemA;
  c.svApplyMediaModalArtwork(stalePreview, itemA, 'movie', itemA);
  c.currentMediaModalItem = itemB;
  c.svApplyMediaModalArtwork(stalePreview, itemB, 'movie', itemB);
  const bUrl = [...h.pending.keys()].find(url => url.includes('/b.jpg'));
  const aUrl = [...h.pending.keys()].find(url => url.includes('/a.jpg'));
  h.pending.get(bUrl).finish();
  await flush();
  assert(stalePreview.poster.includes('/b.jpg'));
  h.pending.get(aUrl).finish();
  await flush();
  assert(stalePreview.poster.includes('/b.jpg'), 'stale title must not overwrite current artwork');

  h.reset();
  h.setBehavior(url => ({
    width: url.includes('/w780/') ? 780 : 1280,
    height: url.includes('/w780/') ? 1170 : 720
  }));
  const portraitOnly = {
    id: 'portrait-only',
    name: 'Portrait Only',
    poster: 'https://image.tmdb.org/t/p/w342/portrait.jpg'
  };
  const portraitPreview = fakePreview();
  c.currentMediaModalItem = portraitOnly;
  c.svApplyMediaModalArtwork(portraitPreview, portraitOnly, 'movie', portraitOnly);
  assert(portraitPreview.poster.includes('/w342/'), 'portrait preview must be immediate');
  assert(portraitPreview.hero.classList.contains('is-portrait-artwork'), 'portrait preview must never stretch across the hero');
  await flush();
  assert(portraitPreview.poster.includes('/w780/'));
  assert.strictEqual(portraitPreview.dataset.artworkState, 'portrait-fallback');
  assert(portraitPreview.hero.classList.contains('is-portrait-artwork'), 'portrait fallback composition must activate');

  assert.notStrictEqual(
    c.svModalArtworkCacheKey({ id: 'same-id' }, 'movie', 'backdrop'),
    c.svModalArtworkCacheKey({ id: 'same-id' }, 'tv', 'backdrop'),
    'movie and series cache keys must not collide'
  );
  const stableIdItem = { id: 'stable-artwork-id', name: 'Stable Key' };
  const beforeMetadata = c.svModalArtworkCacheKey(stableIdItem, 'movie', 'backdrop');
  stableIdItem.tmdbId = 12345;
  assert.strictEqual(
    c.svModalArtworkCacheKey(stableIdItem, 'movie', 'backdrop'),
    beforeMetadata,
    'late TMDB metadata must not change an existing stable media cache key'
  );

  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'hostinger', 'catalog.json'), 'utf8'));
  const all = [...(catalog.movies || []), ...(catalog.series || [])];
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const representatives = [
    all.find(item => normalize(item.title || item.name).startsWith('guardians of the galaxy vol')),
    all.find(item => normalize(item.title || item.name).startsWith('thor love and thunder')),
    all.find(item => normalize(item.title || item.name).startsWith('avengers age of ultron')),
    all.find(item => normalize(item.title || item.name).startsWith('avengers infinity war')),
    all.find(item => normalize(item.title || item.name).startsWith('game of thrones'))
  ];
  representatives.forEach(item => {
    assert(item?.backdrop, `representative title is missing a backdrop: ${item?.title || item?.name || 'unknown'}`);
    const candidate = c.svModalArtworkCandidates(item, item.seasons ? 'tv' : 'movie', 'backdrop')[0];
    assert(candidate.url.includes('/w1280/'), `${item.title || item.name} did not resolve w1280`);
  });

  const polish = fs.readFileSync(path.join(root, 'hostinger', 'media-popup-polish-v8.js'), 'utf8');
  assert(polish.includes('svCaptureModalArtworkPreview'), 'popup polish must delegate preview capture');
  assert(!polish.includes('preview.poster='), 'popup polish must not override authoritative artwork');
  assert(!polish.includes('setAttribute("poster"'), 'popup polish must not protect a low-resolution poster');

  const css = fs.readFileSync(path.join(root, 'hostinger', 'modal-hd-artwork-v2.css'), 'utf8');
  assert(css.includes('.hero-section.is-portrait-artwork::before'));
  assert(css.includes('filter:blur(24px) brightness(.42)'));
  assert(css.includes('object-fit:contain'));
  assert(css.includes('object-position:center 22%'));
  assert(css.includes('object-position:center 20%'));
  assert(css.includes('object-position:center 18%'));

  for (const relative of [
    'hostinger/sw-20260714-v4.js',
    'hostinger/sw.js',
    'public/sw-20260714-v4.js',
    'public/sw.js'
  ]) {
    const sw = fs.readFileSync(path.join(root, relative), 'utf8');
    assert(sw.includes('function isModalHdArtworkRequest'));
    assert(sw.indexOf('if(isModalHdArtworkRequest(request,url))') < sw.indexOf('if(isPosterRequest(request,url))'));
    assert(sw.includes("url.searchParams.get('sv-modal-hd') === 'v2'"));
  }

  console.log('Modal HD artwork v2 deterministic tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
