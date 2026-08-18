'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const VERSION = '20260819-mobile-direct-v1';
const DEFAULT_REVERIFY_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_SCAN_INTERVAL_MS = 5000;
const DEFAULT_INITIAL_BURST = 24;
const DEFAULT_CANDIDATE_CAP = 4000;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function extensionLooksMobile(value) {
  const pathname = String(value || '').split(/[?#]/)[0].toLowerCase();
  return /\.(?:mp4|m4v)$/.test(pathname);
}

function normalizeContainer(value) {
  return String(value || '').toLowerCase();
}

function containerIsMobileSafe(value) {
  const text = normalizeContainer(value);
  return text.includes('mp4') || text.includes('mov');
}

function audioCodec(track) {
  return String(track?.codec || track?.codec_name || '').toLowerCase();
}

function audioIsAac(track) {
  return audioCodec(track) === 'aac';
}

function sourceVerdict(info, range) {
  const audioTracks = safeArray(info?.audioTracks);
  const singleAacAudio = audioTracks.length === 1 && audioIsAac(audioTracks[0]);
  const videoCodec = String(info?.videoCodec || '').toLowerCase();
  const container = normalizeContainer(info?.container);
  const range206 = Number(range?.statusCode) === 206 && /bytes\s+\d+-\d+\/\d+/i.test(String(range?.contentRange || ''));
  const ok = range206 && containerIsMobileSafe(container) && videoCodec === 'h264' && singleAacAudio;
  return {
    ok,
    range206,
    container,
    videoCodec,
    audioCodec: audioTracks.length ? audioCodec(audioTracks[0]) : '',
    audioTrackCount: audioTracks.length,
    duration: Number(info?.duration) || 0,
    reason: ok
      ? 'verified-h264-aac-mp4-range206'
      : [
          range206 ? '' : 'no-range-206',
          containerIsMobileSafe(container) ? '' : `container:${container || 'unknown'}`,
          videoCodec === 'h264' ? '' : `video:${videoCodec || 'unknown'}`,
          singleAacAudio ? '' : `audio:${audioTracks.length}:${audioTracks.map(audioCodec).join(',') || 'none'}`,
        ].filter(Boolean).join('|')
  };
}

function withTimeout(promise, ms, label) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label || 'operation'} timed out`)), ms);
      timer.unref?.();
    })
  ]).finally(() => clearTimeout(timer));
}

function requestRange(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 4) return reject(new Error('too many redirects'));
    let parsed;
    try { parsed = new URL(url); }
    catch { return reject(new Error('invalid URL')); }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(parsed, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-1',
        'User-Agent': 'StreamVault-Mobile-Direct-Probe/1.0',
        Accept: '*/*'
      }
    }, res => {
      const status = Number(res.statusCode) || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        const next = new URL(res.headers.location, parsed).href;
        res.resume();
        return requestRange(next, redirects + 1).then(resolve, reject);
      }
      const result = {
        statusCode: status,
        contentRange: String(res.headers['content-range'] || ''),
        acceptRanges: String(res.headers['accept-ranges'] || ''),
        contentLength: Number(res.headers['content-length']) || 0,
        contentType: String(res.headers['content-type'] || ''),
        finalUrl: parsed.href
      };
      res.destroy();
      resolve(result);
    });
    req.setTimeout(8000, () => req.destroy(new Error('range probe timed out')));
    req.on('error', reject);
    req.end();
  });
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, file);
}

function cleanTitle(value) {
  return String(value || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleIdentity(item) {
  return [
    String(item?.type || ''),
    String(item?.id || ''),
    cleanTitle(item?.name || item?.title || ''),
    String(item?.year || '')
  ].join('|');
}

function cloneSeriesWithVerifiedEpisodes(show, sourceMap) {
  const seasons = show?.seasons || {};
  const out = {};
  let episodeCount = 0;
  for (const [season, episodes] of Object.entries(seasons)) {
    const list = safeArray(episodes);
    if (!list.length) continue;
    const verified = [];
    for (const ep of list) {
      const url = String(ep?.streamUrl || '').trim();
      const verdict = sourceMap[url];
      if (!url || !verdict?.mobileDirect) return null;
      verified.push({ ...ep, mobileDirect: true, mobileDirectVerifiedAt: verdict.verifiedAt });
      episodeCount += 1;
    }
    out[season] = verified;
  }
  if (!episodeCount) return null;
  return { ...show, type: 'series', seasons: out, mobileDirect: true, mobileDirectEpisodeCount: episodeCount };
}

function installMobileDirect(options = {}) {
  const app = options.app;
  if (!app || typeof app.get !== 'function') throw new Error('installMobileDirect requires Express app');
  if (app.locals?.__svMobileDirectV1) return app.locals.__svMobileDirectV1;

  const cacheDir = options.cacheDir || path.join(process.cwd(), 'cache');
  const cacheFile = path.join(cacheDir, 'mobile-direct-catalog.json');
  const getMediaInfo = options.getMediaInfo;
  const getMovies = options.getMovies;
  const getSeries = options.getSeries;
  if (typeof getMediaInfo !== 'function' || typeof getMovies !== 'function' || typeof getSeries !== 'function') {
    throw new Error('installMobileDirect missing catalog/media callbacks');
  }

  const reverifyMs = Math.max(60_000, Number(process.env.SV_MOBILE_DIRECT_REVERIFY_MS || DEFAULT_REVERIFY_MS));
  const scanIntervalMs = Math.max(1500, Number(process.env.SV_MOBILE_DIRECT_SCAN_INTERVAL_MS || DEFAULT_SCAN_INTERVAL_MS));
  const initialBurst = Math.max(1, Math.min(100, Number(process.env.SV_MOBILE_DIRECT_INITIAL_BURST || DEFAULT_INITIAL_BURST)));
  const candidateCap = Math.max(100, Number(process.env.SV_MOBILE_DIRECT_CANDIDATE_CAP || DEFAULT_CANDIDATE_CAP));

  const loaded = readJson(cacheFile, {});
  const state = {
    version: VERSION,
    startedAt: Date.now(),
    scanning: false,
    queued: 0,
    checked: 0,
    passed: 0,
    failed: 0,
    lastScanAt: 0,
    cache: {
      version: VERSION,
      updatedAt: loaded.updatedAt || null,
      sources: loaded.sources && typeof loaded.sources === 'object' ? loaded.sources : {},
      items: safeArray(loaded.items)
    },
    queue: [],
    queueBuilt: false,
    saveTimer: null
  };

  function scheduleSave() {
    if (state.saveTimer) return;
    state.saveTimer = setTimeout(() => {
      state.saveTimer = null;
      state.cache.updatedAt = new Date().toISOString();
      try { atomicWriteJson(cacheFile, state.cache); }
      catch (error) { console.error('[Mobile Direct] cache save failed:', error.message); }
    }, 400);
    state.saveTimer.unref?.();
  }

  function cachedFresh(url) {
    const entry = state.cache.sources[url];
    const checkedAt = Date.parse(entry?.verifiedAt || entry?.checkedAt || 0) || 0;
    return entry && Date.now() - checkedAt < reverifyMs;
  }

  async function verifySource(url) {
    if (!isHttpUrl(url)) return null;
    if (cachedFresh(url)) return state.cache.sources[url];
    const checkedAt = new Date().toISOString();
    try {
      const range = await withTimeout(requestRange(url), 10_000, 'range probe');
      const info = await withTimeout(getMediaInfo(url), 22_000, 'media probe');
      const verdict = sourceVerdict(info, range);
      const entry = {
        url,
        mobileDirect: verdict.ok,
        checkedAt,
        verifiedAt: verdict.ok ? checkedAt : null,
        range206: verdict.range206,
        contentLength: Number(range.contentLength) || 0,
        contentType: range.contentType || '',
        container: verdict.container,
        videoCodec: verdict.videoCodec,
        audioCodec: verdict.audioCodec,
        audioTrackCount: verdict.audioTrackCount,
        duration: verdict.duration,
        reason: verdict.reason
      };
      state.cache.sources[url] = entry;
      state.checked += 1;
      if (entry.mobileDirect) state.passed += 1;
      else state.failed += 1;
      scheduleSave();
      return entry;
    } catch (error) {
      const entry = { url, mobileDirect: false, checkedAt, verifiedAt: null, range206: false, reason: `probe-error:${error.message}` };
      state.cache.sources[url] = entry;
      state.checked += 1;
      state.failed += 1;
      scheduleSave();
      return entry;
    }
  }

  function movieCandidates() {
    let list = [];
    try { list = safeArray(getMovies()); } catch (error) { console.error('[Mobile Direct] movie catalog failed:', error.message); }
    return list
      .filter(item => isHttpUrl(item?.streamUrl) && extensionLooksMobile(item.streamUrl))
      .sort((a, b) => Number(!!b.poster) - Number(!!a.poster) || Number(b.rating || 0) - Number(a.rating || 0));
  }

  function seriesCandidates() {
    let list = [];
    try { list = safeArray(getSeries()); } catch (error) { console.error('[Mobile Direct] series catalog failed:', error.message); }
    return list.filter(show => {
      const episodes = Object.values(show?.seasons || {}).flatMap(safeArray);
      return episodes.length > 0 && episodes.every(ep => isHttpUrl(ep?.streamUrl) && extensionLooksMobile(ep.streamUrl));
    });
  }

  function rebuildItems() {
    const next = [];
    const sourceMap = state.cache.sources;
    const seen = new Set();
    for (const movie of movieCandidates()) {
      const source = sourceMap[String(movie.streamUrl || '')];
      if (!source?.mobileDirect) continue;
      const item = {
        ...movie,
        type: 'movie',
        mobileDirect: true,
        mobileDirectVerifiedAt: source.verifiedAt,
        mobileDirectProfile: 'MP4 / H.264 / AAC / HTTP 206',
        mobileDirectDuration: source.duration || 0
      };
      const key = titleIdentity(item);
      if (!seen.has(key)) { seen.add(key); next.push(item); }
      if (next.length >= 160) break;
    }
    for (const show of seriesCandidates()) {
      const item = cloneSeriesWithVerifiedEpisodes(show, sourceMap);
      if (!item) continue;
      const key = titleIdentity(item);
      if (!seen.has(key)) { seen.add(key); next.push(item); }
      if (next.length >= 200) break;
    }
    next.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || String(a.name || a.title || '').localeCompare(String(b.name || b.title || '')));
    state.cache.items = next;
    scheduleSave();
    return next;
  }

  function buildQueue() {
    if (state.queueBuilt) return;
    state.queueBuilt = true;
    const urls = [];
    const add = url => {
      const value = String(url || '').trim();
      if (!value || !isHttpUrl(value) || !extensionLooksMobile(value)) return;
      if (cachedFresh(value)) return;
      if (!urls.includes(value)) urls.push(value);
    };
    for (const movie of movieCandidates()) {
      add(movie.streamUrl);
      if (urls.length >= candidateCap) break;
    }
    if (urls.length < candidateCap) {
      for (const show of seriesCandidates()) {
        for (const episodes of Object.values(show.seasons || {})) {
          for (const ep of safeArray(episodes)) {
            add(ep.streamUrl);
            if (urls.length >= candidateCap) break;
          }
          if (urls.length >= candidateCap) break;
        }
        if (urls.length >= candidateCap) break;
      }
    }
    state.queue = urls;
    state.queued = urls.length;
    rebuildItems();
    console.log(`[Mobile Direct] queued ${urls.length} strict MP4 candidates; cached verified titles=${state.cache.items.length}`);
  }

  async function scanOne() {
    if (state.scanning) return;
    buildQueue();
    const url = state.queue.shift();
    state.queued = state.queue.length;
    if (!url) return;
    state.scanning = true;
    state.lastScanAt = Date.now();
    try { await verifySource(url); rebuildItems(); }
    finally { state.scanning = false; }
  }

  async function scanBurst() {
    buildQueue();
    const count = Math.min(initialBurst, state.queue.length);
    for (let i = 0; i < count; i += 1) {
      const url = state.queue.shift();
      state.queued = state.queue.length;
      if (!url) break;
      await verifySource(url);
      if ((i + 1) % 4 === 0) rebuildItems();
    }
    rebuildItems();
  }

  function isCertified(url) {
    return !!state.cache.sources[String(url || '').trim()]?.mobileDirect;
  }

  function proxyCertified(req, res) {
    const source = String(req.query.url || '').trim();
    if (!isCertified(source)) return res.status(403).json({ error: 'Source is not mobile-direct certified' });
    let parsed;
    try { parsed = new URL(source); }
    catch { return res.status(400).json({ error: 'Invalid source URL' }); }

    const requestUpstream = (target, redirects = 0) => {
      if (redirects > 4) return res.status(502).end();
      const client = target.protocol === 'https:' ? https : http;
      const headers = {
        'User-Agent': req.get('user-agent') || 'StreamVault-Mobile-Direct/1.0',
        Accept: req.get('accept') || '*/*'
      };
      if (req.headers.range) headers.Range = req.headers.range;
      if (req.headers['if-range']) headers['If-Range'] = req.headers['if-range'];
      const upstream = client.request(target, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers }, upstreamRes => {
        const status = Number(upstreamRes.statusCode) || 502;
        if (status >= 300 && status < 400 && upstreamRes.headers.location) {
          const next = new URL(upstreamRes.headers.location, target);
          upstreamRes.resume();
          return requestUpstream(next, redirects + 1);
        }
        res.status(status);
        const passthrough = ['content-length','content-range','accept-ranges','etag','last-modified','cache-control'];
        for (const name of passthrough) if (upstreamRes.headers[name] !== undefined) res.setHeader(name, upstreamRes.headers[name]);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', upstreamRes.headers['accept-ranges'] || 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-StreamVault-Mobile-Direct', '1');
        if (req.method === 'HEAD') { upstreamRes.resume(); return res.end(); }
        req.on('close', () => { try { upstream.destroy(); } catch {} });
        upstreamRes.pipe(res);
      });
      upstream.setTimeout(15_000, () => upstream.destroy(new Error('upstream timeout')));
      upstream.on('error', error => {
        if (!res.headersSent) res.status(502).json({ error: 'Mobile direct source failed', detail: error.message });
        else res.destroy(error);
      });
      upstream.end();
    };
    requestUpstream(parsed);
  }

  app.get('/api/mobile-direct/catalog', (req, res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 60) || 60));
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.json({
      ok: true,
      version: VERSION,
      profile: { container: 'mp4', video: 'h264', audio: 'aac-single-track', range206: true, transcoding: false },
      total: state.cache.items.length,
      updatedAt: state.cache.updatedAt,
      scanning: state.scanning || state.queue.length > 0,
      items: state.cache.items.slice(0, limit)
    });
  });

  app.get('/api/mobile-direct/status', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      version: VERSION,
      cacheFile,
      verifiedTitles: state.cache.items.length,
      verifiedSources: Object.values(state.cache.sources).filter(row => row?.mobileDirect).length,
      checkedSources: Object.keys(state.cache.sources).length,
      queued: state.queue.length,
      scanning: state.scanning,
      checkedThisRun: state.checked,
      passedThisRun: state.passed,
      failedThisRun: state.failed,
      lastScanAt: state.lastScanAt ? new Date(state.lastScanAt).toISOString() : null
    });
  });

  app.get('/api/mobile-direct/proxy', proxyCertified);
  app.head('/api/mobile-direct/proxy', proxyCertified);

  const initialTimer = setTimeout(() => scanBurst().catch(error => console.error('[Mobile Direct] initial scan failed:', error.message)), 3000);
  initialTimer.unref?.();
  const interval = setInterval(() => scanOne().catch(error => console.error('[Mobile Direct] scan failed:', error.message)), scanIntervalMs);
  interval.unref?.();

  const api = { version: VERSION, state, verifySource, rebuildItems, isCertified };
  app.locals.__svMobileDirectV1 = api;
  console.log(`[Mobile Direct] ${VERSION} installed; cached titles=${state.cache.items.length}`);
  return api;
}

module.exports = { installMobileDirect, sourceVerdict };
