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
  { name: 'search-iron-man', path: '/api/search?q=iron%20man', kind: 'search' },
  { name: 'search-oblivion', path: '/api/search?q=oblivion', kind: 'search' },
  { name: 'channels', path: '/api/channels', kind: 'channels' },
];

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
    const nodeResult = await fetchEndpoint(nodeBase, ep, nodeDir);
    const haskellResult = await fetchEndpoint(haskellBase, ep, haskellDir);
    rows.push(compareEndpoint(ep, nodeResult, haskellResult));
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

async function fetchEndpoint(base, ep, targetDir) {
  const url = base + ep.path;
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
      status: res.status,
      ms: Date.now() - started,
      bytes: Buffer.byteLength(text),
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
    kind: ep.kind,
    pass: diffs.length === 0,
    diffs,
    node: stripForReport(nodeResult, nodeShape),
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
        sample: (json.items || []).slice(0, 10).map(identityOf),
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
    lines.push(`  node:    status=${row.node.status} bytes=${row.node.bytes} ms=${row.node.ms}`);
    lines.push(`  haskell: status=${row.haskell.status} bytes=${row.haskell.bytes} ms=${row.haskell.ms}`);
    if (row.diffs.length) {
      for (const diff of row.diffs) lines.push(`  - ${diff}`);
    }
  }
  lines.push('');
  lines.push(`JSON report: ${path.join(outDir, 'parity-report.json')}`);
  return lines.join('\n');
}
