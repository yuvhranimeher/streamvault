#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = findRoot(process.cwd());
const outDir = path.join(root, 'tools', 'haskell-parity', 'out');
const snapshotsDir = path.join(outDir, 'snapshots');
const reportsDir = path.join(outDir, 'reports');
const nodeDir = path.join(snapshotsDir, 'node');
const haskellDir = path.join(snapshotsDir, 'haskell');

const nodeBase = (process.env.NODE_BASE || process.argv.find(a => a.startsWith('--node='))?.slice(7) || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const haskellBase = (process.env.HASKELL_BASE || process.argv.find(a => a.startsWith('--haskell='))?.slice(10) || 'http://127.0.0.1:3031').replace(/\/+$/, '');
const timeoutMs = Number(process.env.PARITY_TIMEOUT_MS || process.argv.find(a => a.startsWith('--timeout='))?.slice(10) || 180000);

const endpoints = [
  { name: 'haskell-health', path: '/__haskell-health', kind: 'haskell-health' },
  { name: 'api-health', path: '/api/health', kind: 'haskell-health' },
  { name: 'downloads-page1-limit40', path: '/api/downloads?page=1&limit=40', kind: 'downloads' },
  { name: 'movies-page1-limit40', path: '/api/movies?page=1&limit=40', kind: 'movies' },
  { name: 'series-page1-limit40', path: '/api/series?page=1&limit=40', kind: 'series' },
  { name: 'home-feed', path: '/api/home-feed', kind: 'home-feed' },
  searchEndpoint('search-iron-man', 'iron%20man'),
  searchEndpoint('search-oblivion', 'oblivion'),
  searchEndpoint('search-oblibion', 'oblibion'),
  searchEndpoint('search-the-boys', 'the%20boys'),
  searchEndpoint('search-extraction', 'extraction'),
  searchEndpoint('search-pirates-caribbean', 'pirates%20caribbean'),
  searchEndpoint('search-spider-man', 'spider%20man'),
  searchEndpoint('search-dark-knight', 'dark%20knight'),
  searchEndpoint('search-breaking-bad', 'breaking%20bad'),
  searchEndpoint('search-game-of-thrones', 'game%20of%20thrones'),
  { name: 'channels', path: '/api/channels', kind: 'channels' },
  { name: 'section-marvel', path: '/api/section/marvel?page=1&limit=20', kind: 'section' },
  { name: 'section-dc', path: '/api/section/dc?page=1&limit=20', kind: 'section' },
  { name: 'section-netflix', path: '/api/section/netflix?page=1&limit=20', kind: 'section' },
  {
    name: 'details-movie-cache-hit',
    path: '/api/details/movie/Man%20of%20Steel?title=Man%20of%20Steel&year=2013',
    kind: 'details-cache-hit',
    haskellOnly: true,
  },
  {
    name: 'details-title-only-cache-hit',
    path: '/api/details/movie/Man%20of%20Steel?title=Man%20of%20Steel',
    kind: 'details-cache-hit',
    haskellOnly: true,
  },
  {
    name: 'details-cache-key-id-hit',
    path: '/api/details/movie/movie%3AMan%20of%20Steel%3A2013?title=Man%20of%20Steel&year=2013',
    kind: 'details-cache-hit',
    haskellOnly: true,
  },
  {
    name: 'details-series-cache-hit',
    path: '/api/details/tv/76479?title=The%20Boys&year=2019&tmdbId=76479',
    kind: 'details-cache-hit',
    haskellOnly: true,
  },
  {
    name: 'details-pirates-cache-hit',
    path: '/api/details/movie/Pirates%20of%20the%20Caribbean-Dead%20Men%20Tell%20No%20Tales?title=Pirates%20of%20the%20Caribbean-Dead%20Men%20Tell%20No%20Tales&year=2017',
    kind: 'details-cache-hit',
    haskellOnly: true,
  },
  {
    name: 'details-pirates-punctuation-cache-hit',
    path: '/api/details/movie/Pirates%20of%20the%20Caribbean%3A%20Dead%20Men%20Tell%20No%20Tales?title=Pirates%20of%20the%20Caribbean%3A%20Dead%20Men%20Tell%20No%20Tales&year=2017',
    kind: 'details-cache-hit',
    haskellOnly: true,
  },
  {
    name: 'details-extraction-cache-hit',
    path: '/api/details/movie/Extraction?title=Extraction&year=2020',
    kind: 'details-cache-hit',
    haskellOnly: true,
  },
  {
    name: 'details-dark-knight-cache-hit',
    path: '/api/details/movie/The%20Dark%20Knight?title=The%20Dark%20Knight&year=2008',
    kind: 'details-cache-hit',
    haskellOnly: true,
  },
];

function searchEndpoint(name, encodedQuery) {
  return {
    name,
    path: `/api/search?q=${encodedQuery}`,
    haskellPath: `/__haskell-search-debug?q=${encodedQuery}`,
    kind: 'search',
  };
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(nodeDir, { recursive: true });
  fs.mkdirSync(haskellDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  const rows = [];
  for (const ep of endpoints) {
    const haskellResult = await fetchEndpoint(haskellBase, ep, haskellDir, 'haskell');
    if (ep.haskellOnly) {
      rows.push(compareHaskellOnlyEndpoint(ep, haskellResult));
    } else {
      const nodeResult = await fetchEndpoint(nodeBase, ep, nodeDir, 'node');
      rows.push(compareEndpoint(ep, nodeResult, haskellResult));
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    nodeBase,
    haskellBase,
    timeoutMs,
    passed: rows.filter(r => r.pass).length,
    failed: rows.filter(r => !r.pass).length,
    rows,
  };

  const reportJson = JSON.stringify(summary, null, 2);
  const reportText = renderText(summary);
  fs.writeFileSync(path.join(reportsDir, 'parity-report.json'), reportJson);
  fs.writeFileSync(path.join(reportsDir, 'parity-report.txt'), reportText);
  fs.writeFileSync(path.join(outDir, 'parity-report.json'), reportJson);
  fs.writeFileSync(path.join(outDir, 'parity-report.txt'), reportText);

  console.log(reportText);
  if (summary.failed) process.exit(1);
}

function findRoot(start) {
  let dir = start;
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'server.js'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('Run from inside the StreamVault project.');
}

async function fetchEndpoint(base, ep, targetDir, side) {
  const requestPath = side === 'haskell' && ep.haskellPath ? ep.haskellPath : ep.path;
  const url = base + requestPath;
  const file = path.join(targetDir, ep.name + '.json');
  const metaFile = path.join(targetDir, ep.name + '.meta.json');
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    clearTimeout(timer);
    let json = null;
    try { json = JSON.parse(text); } catch {}
    fs.writeFileSync(file, text);
    const result = {
      ok: true,
      url,
      path: requestPath,
      status: res.status,
      ms: Date.now() - started,
      bytes: Buffer.byteLength(text),
      streamvault: res.headers.get('x-streamvault-haskell') || null,
      json,
      text: json ? undefined : text.slice(0, 400),
    };
    fs.writeFileSync(metaFile, JSON.stringify(stripPayload(result), null, 2));
    return result;
  } catch (err) {
    clearTimeout(timer);
    const result = {
      ok: false,
      url,
      path: requestPath,
      status: 0,
      ms: Date.now() - started,
      bytes: 0,
      error: err && err.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(err && err.message ? err.message : err),
    };
    fs.writeFileSync(metaFile, JSON.stringify(result, null, 2));
    return result;
  }
}

function stripPayload(result) {
  const { json, ...rest } = result;
  return rest;
}

function compareEndpoint(ep, nodeResult, haskellResult) {
  if (ep.kind === 'haskell-health') {
    return compareHaskellHealth(ep, nodeResult, haskellResult);
  }
  if (ep.kind === 'search') {
    return compareSearchEndpoint(ep, nodeResult, haskellResult);
  }

  const nodeShape = shape(ep.kind, nodeResult);
  const haskellShape = shape(ep.kind, haskellResult);
  const diffs = [];

  if (!nodeResult.ok) diffs.push(`Node fetch failed: ${nodeResult.error}`);
  if (!haskellResult.ok) diffs.push(`Haskell fetch failed: ${haskellResult.error}`);
  if (nodeResult.ok && haskellResult.ok && nodeResult.status !== haskellResult.status) {
    diffs.push(`status ${nodeResult.status} != ${haskellResult.status}`);
  }

  compareShape('', nodeShape, haskellShape, diffs);

  return {
    name: ep.name,
    path: ep.path,
    haskellPath: ep.haskellPath || ep.path,
    kind: ep.kind,
    pass: diffs.length === 0,
    diffs,
    node: stripForReport(nodeResult, nodeShape),
    haskell: stripForReport(haskellResult, haskellShape),
  };
}

function compareSearchEndpoint(ep, nodeResult, haskellResult) {
  const nodeShape = shape(ep.kind, nodeResult);
  const haskellShape = shape(ep.kind, haskellResult);
  const diffs = [];
  const warnings = [];

  if (!nodeResult.ok) diffs.push(`Node fetch failed: ${nodeResult.error}`);
  if (!haskellResult.ok) diffs.push(`Haskell fetch failed: ${haskellResult.error}`);
  if (nodeResult.ok && haskellResult.ok && nodeResult.status !== haskellResult.status) {
    diffs.push(`status ${nodeResult.status} != ${haskellResult.status}`);
  }

  const nodeJson = nodeResult.json || {};
  const haskellJson = haskellResult.json || {};
  const nodeItems = Array.isArray(nodeJson.items) ? nodeJson.items : [];
  const haskellItems = Array.isArray(haskellJson.items) ? haskellJson.items : [];
  const expectedKeys = ['indexed', 'instant', 'items', 'page', 'pages', 'total'];
  const nodeKeys = Object.keys(nodeJson).sort();
  const haskellKeys = Object.keys(haskellJson).sort();
  if (!sameJson(nodeKeys, expectedKeys)) warnings.push(`Node search keys ${JSON.stringify(nodeKeys)} differ from expected ${JSON.stringify(expectedKeys)}`);
  if (!sameJson(haskellKeys, expectedKeys)) diffs.push(`Haskell search keys ${JSON.stringify(haskellKeys)} differ from expected ${JSON.stringify(expectedKeys)}`);
  for (const key of ['total', 'page', 'pages', 'instant', 'indexed']) {
    if (nodeJson[key] !== haskellJson[key]) diffs.push(`${key} ${JSON.stringify(nodeJson[key])} != ${JSON.stringify(haskellJson[key])}`);
  }
  if (nodeItems.length !== haskellItems.length) diffs.push(`items.length ${nodeItems.length} != ${haskellItems.length}`);

  const nodeTop = nodeItems.slice(0, 20).map(searchIdentityOf);
  const haskellTop = haskellItems.slice(0, 20).map(searchIdentityOf);
  const nodeTopKeys = nodeTop.map(searchCompareKey);
  const haskellTopKeys = haskellTop.map(searchCompareKey);
  const overlap = nodeTopKeys.filter(k => haskellTopKeys.includes(k)).length;
  const neededOverlap = Math.min(12, nodeTopKeys.length, haskellTopKeys.length);
  if (!sameJson(nodeTopKeys, haskellTopKeys)) {
    const msg = `first20 order differs; overlap=${overlap}/${Math.min(nodeTopKeys.length, haskellTopKeys.length)}`;
    if (overlap < neededOverlap) diffs.push(msg);
    else warnings.push(msg);
  }

  const posterDelta = Math.abs(nodeTop.filter(x => x.poster).length - haskellTop.filter(x => x.poster).length);
  const backdropDelta = Math.abs(nodeTop.filter(x => x.backdrop).length - haskellTop.filter(x => x.backdrop).length);
  if (posterDelta > 5) diffs.push(`first20 poster presence delta ${posterDelta} > 5`);
  if (backdropDelta > 5) warnings.push(`first20 backdrop presence delta ${backdropDelta}`);

  const haskellByKey = new Map(haskellTop.map(item => [searchCompareKey(item), item]));
  for (const nodeItem of nodeTop) {
    const hItem = haskellByKey.get(searchCompareKey(nodeItem));
    if (!hItem) continue;
    if (nodeItem.tmdbId && hItem.tmdbId && String(nodeItem.tmdbId) !== String(hItem.tmdbId)) {
      diffs.push(`tmdbId mismatch for ${nodeItem.name}: ${nodeItem.tmdbId} != ${hItem.tmdbId}`);
    }
  }

  return {
    name: ep.name,
    path: ep.path,
    haskellPath: ep.haskellPath || ep.path,
    kind: ep.kind,
    pass: diffs.length === 0,
    diffs,
    warnings,
    node: stripForReport(nodeResult, nodeShape),
    haskell: stripForReport(haskellResult, haskellShape),
  };
}

function compareHaskellOnlyEndpoint(ep, haskellResult) {
  const haskellShape = shape(ep.kind, haskellResult);
  const diffs = [];
  if (!haskellResult.ok) diffs.push(`Haskell fetch failed: ${haskellResult.error}`);
  if (haskellResult.ok && haskellResult.status !== 200) diffs.push(`Haskell status ${haskellResult.status} != 200`);
  if (haskellResult.ok && haskellResult.streamvault !== 'native-details-cache') {
    diffs.push(`Haskell route marker ${JSON.stringify(haskellResult.streamvault)} != "native-details-cache"`);
  }
  if (haskellResult.ok) {
    const json = haskellResult.json || {};
    if (json.ok !== true) diffs.push('details ok != true');
    if (json.localOnly !== false) diffs.push('details localOnly != false');
    for (const key of ['trailers', 'cast', 'crew', 'productionCompanies', 'similar']) {
      if (!Array.isArray(json[key]) || json[key].length === 0) diffs.push(`details ${key} is empty or missing`);
    }
  }
  return {
    name: ep.name,
    path: ep.path,
    haskellPath: ep.haskellPath || ep.path,
    kind: ep.kind,
    mode: 'haskell-only-cache-hit',
    pass: diffs.length === 0,
    diffs,
    node: {
      skipped: true,
      reason: 'Node details route bypasses disk detail-cache.json and may call TMDB; this row verifies the native Haskell cache-hit path only.',
    },
    haskell: stripForReport(haskellResult, haskellShape),
  };
}

function compareHaskellHealth(ep, nodeResult, haskellResult) {
  const haskellShape = shape(ep.kind, haskellResult);
  const nodeShape = shape(ep.kind, nodeResult);
  const diffs = [];
  if (!haskellResult.ok) diffs.push(`Haskell fetch failed: ${haskellResult.error}`);
  if (haskellResult.ok && haskellResult.status !== 200) diffs.push(`Haskell status ${haskellResult.status} != 200`);
  if (haskellResult.ok && (!haskellResult.json || haskellResult.json.ok !== true)) {
    diffs.push('Haskell health JSON does not include ok=true');
  }
  if (haskellResult.ok && haskellResult.json && haskellResult.json.runtime !== 'haskell-gateway') {
    diffs.push(`Haskell runtime ${JSON.stringify(haskellResult.json.runtime)} != "haskell-gateway"`);
  }
  return {
    name: ep.name,
    path: ep.path,
    haskellPath: ep.haskellPath || ep.path,
    kind: ep.kind,
    pass: diffs.length === 0,
    diffs,
    node: stripForReport(nodeResult, nodeShape),
    haskell: stripForReport(haskellResult, haskellShape),
  };
}

function stripForReport(result, summary) {
  return {
    ok: result.ok,
    status: result.status,
    ms: result.ms,
    bytes: result.bytes,
    streamvault: result.streamvault || null,
    error: result.error || null,
    summary,
  };
}

function compareShape(prefix, a, b, diffs) {
  if (typeof a !== typeof b) {
    diffs.push(`${prefix || 'shape'} type ${typeof a} != ${typeof b}`);
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      diffs.push(`${prefix || 'shape'} array mismatch`);
      return;
    }
    if (a.length !== b.length) diffs.push(`${prefix}.length ${a.length} != ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) compareShape(`${prefix}[${i}]`, a[i], b[i], diffs);
    return;
  }
  if (a && typeof a === 'object') {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b || {})])].sort();
    for (const key of keys) compareShape(prefix ? `${prefix}.${key}` : key, a[key], b ? b[key] : undefined, diffs);
    return;
  }
  if (a !== b) diffs.push(`${prefix} ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}

function shape(kind, result) {
  if (!result.ok) return { fetch: 'failed' };
  const json = result.json;
  if (json === null || json === undefined) return { root: 'non-json' };
  if (Array.isArray(json)) {
    return {
      root: 'array',
      length: json.length,
      itemKeys: keysOf(json[0]),
      sample: json.slice(0, 5).map(identityOf),
    };
  }
  if (typeof json !== 'object') return { root: typeof json };

  switch (kind) {
    case 'downloads':
      return envelopeShape(json, 'items');
    case 'movies':
      return envelopeShape(json, 'movies');
    case 'series':
      return envelopeShape(json, 'series');
    case 'search':
      return {
        keys: Object.keys(json).sort(),
        length: Array.isArray(json.items) ? json.items.length : null,
        total: json.total,
        page: json.page,
        pages: json.pages,
        instant: json.instant,
        indexed: json.indexed,
        itemKeys: keysOf(json.items && json.items[0]).filter(k => !k.startsWith('_sv')),
        first20: (json.items || []).slice(0, 20).map(searchIdentityOf),
      };
    case 'home-feed':
      return {
        keys: Object.keys(json).sort(),
        ok: json.ok,
        heroLength: Array.isArray(json.hero) ? json.hero.length : null,
        rowCount: Array.isArray(json.rows) ? json.rows.length : null,
        rows: (json.rows || []).map(row => ({
          rowId: row.rowId,
          sectionKey: row.sectionKey,
          itemCount: Array.isArray(row.items) ? row.items.length : null,
          itemKeys: keysOf(row.items && row.items[0]).filter(k => !k.startsWith('_sv')),
        })),
      };
    case 'channels':
      return {
        root: 'array',
        length: Array.isArray(json) ? json.length : null,
        itemKeys: keysOf(Array.isArray(json) ? json[0] : null),
        sample: Array.isArray(json) ? json.slice(0, 5).map(identityOf) : [],
      };
    case 'section':
      return envelopeShape(json, 'items');
    case 'details-cache-hit':
      return {
        keys: Object.keys(json).sort(),
        ok: json.ok,
        localOnly: json.localOnly,
        type: json.type,
        id: json.id ?? null,
        tmdbId: json.tmdbId ?? null,
        title: json.title ?? json.name ?? null,
        year: json.year ?? null,
        poster: !!json.poster,
        backdrop: !!json.backdrop,
        trailers: Array.isArray(json.trailers) ? json.trailers.length : null,
        cast: Array.isArray(json.cast) ? json.cast.length : null,
        crew: Array.isArray(json.crew) ? json.crew.length : null,
        productionCompanies: Array.isArray(json.productionCompanies) ? json.productionCompanies.length : null,
        similar: Array.isArray(json.similar) ? json.similar.length : null,
        moreByDirector: Array.isArray(json.moreByDirector) ? json.moreByDirector.length : null,
        episodesKind: Array.isArray(json.episodes) ? 'array' : (json.episodes && typeof json.episodes === 'object' ? 'object' : typeof json.episodes),
      };
    case 'haskell-health':
      return {
        keys: Object.keys(json).sort(),
        ok: json.ok,
        runtime: json.runtime || null,
        shadow: Object.prototype.hasOwnProperty.call(json, 'shadow') ? json.shadow : undefined,
        server: json.server || null,
      };
    default:
      return {
        keys: Object.keys(json).sort(),
        error: json.error || null,
        ok: Object.prototype.hasOwnProperty.call(json, 'ok') ? json.ok : undefined,
      };
  }
}

function envelopeShape(json, key) {
  const arr = Array.isArray(json[key]) ? json[key] : [];
  return {
    keys: Object.keys(json).sort(),
    length: arr.length,
    total: json.total,
    page: json.page,
    pages: json.pages,
    itemKeys: keysOf(arr[0]).filter(k => !k.startsWith('_sv')),
    sample: arr.slice(0, 5).map(identityOf),
  };
}

function keysOf(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort() : [];
}

function identityOf(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    id: item.id ?? null,
    name: item.name ?? item.title ?? null,
    title: item.title ?? null,
    year: item.year ?? null,
    type: item.type ?? null,
    isFtp: item.isFtp ?? null,
  };
}

function searchIdentityOf(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    id: item.id ?? null,
    tmdbId: item.tmdbId ?? null,
    name: item.name ?? item.title ?? null,
    title: item.title ?? null,
    year: item.year ?? null,
    type: item.type ?? (item._isSeries || item.seasons ? 'series' : 'movie'),
    poster: !!item.poster,
    backdrop: !!item.backdrop,
  };
}

function searchCompareKey(item) {
  if (!item || typeof item !== 'object') return String(item);
  const type = String(item.type || '').toLowerCase();
  const name = String(item.name || item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const year = String(item.year || '').replace(/[^0-9]/g, '').slice(0, 4);
  const tmdb = item.tmdbId ? `tmdb:${item.tmdbId}` : '';
  return [type, name, year, tmdb].filter(Boolean).join('|');
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function renderText(summary) {
  const lines = [
    'StreamVault Haskell Parity Report',
    '=================================',
    `Generated: ${summary.generatedAt}`,
    `Node:      ${summary.nodeBase}`,
    `Haskell:   ${summary.haskellBase}`,
    `Timeout:   ${summary.timeoutMs}ms`,
    `Result:    ${summary.passed} passed, ${summary.failed} failed`,
    '',
  ];
  for (const row of summary.rows) {
    lines.push(`${row.pass ? 'PASS' : 'FAIL'} ${row.path}`);
    if (row.haskellPath && row.haskellPath !== row.path) {
      lines.push(`  haskell path: ${row.haskellPath}`);
    }
    if (row.node && row.node.skipped) {
      lines.push(`  node:    skipped (${row.node.reason})`);
    } else {
      lines.push(`  node:    status=${row.node.status} bytes=${row.node.bytes} ms=${row.node.ms}`);
    }
    lines.push(`  haskell: status=${row.haskell.status} bytes=${row.haskell.bytes} ms=${row.haskell.ms}`);
    if (row.diffs.length) {
      for (const diff of row.diffs) lines.push(`  - ${diff}`);
    }
    if (row.warnings && row.warnings.length) {
      for (const warning of row.warnings) lines.push(`  ! ${warning}`);
    }
  }
  lines.push('');
  lines.push(`JSON report: ${path.join(outDir, 'parity-report.json')}`);
  return lines.join('\n');
}
