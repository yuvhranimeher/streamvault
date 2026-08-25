'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { once } = require('events');
const { finished } = require('stream/promises');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'scan-output');
const OUT_FILE = path.join(OUT_DIR, 'clean-catalog.json');
const STATUS_FILE = path.join(OUT_DIR, 'search-catalog-status.json');
const VIDEO_EXT_RE = /\.(?:mp4|mkv|avi|mov|webm|m3u8|ts|m2ts|vob|flv|wmv|m4v|mpg|mpeg|3gp)(?:$|[?#])/i;

function safeDecode(value) {
  try { return decodeURIComponent(String(value || '')); }
  catch { return String(value || ''); }
}

function fileTitleFromUrl(url) {
  try {
    const pathname = safeDecode(new URL(url).pathname);
    return path.posix.basename(pathname).replace(/\.[^.]+$/, '');
  } catch {
    return safeDecode(url).split('/').pop()?.replace(/\.[^.]+$/, '') || '';
  }
}

function catalogRoots() {
  const roots = new Set();
  const add = value => {
    if (!value) return;
    const resolved = path.resolve(String(value));
    if (fs.existsSync(resolved)) roots.add(resolved);
  };

  add(process.env.CIRCLE_CATALOG_DIR);
  add(path.join(ROOT, 'circle-catalogs'));
  add(path.join(process.cwd(), 'circle-catalogs'));
  if (process.platform !== 'win32') add('/Volumes/streamvault/circle-catalogs');
  return [...roots];
}

function discoverSources() {
  const jsonl = [];
  const json = [];
  const seen = new Set();
  const add = (list, file) => {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved) || seen.has(resolved)) return;
    seen.add(resolved);
    list.push(resolved);
  };

  for (const root of catalogRoots()) {
    const storage = path.join(root, 'storage');
    if (fs.existsSync(storage)) {
      for (const name of fs.readdirSync(storage)) add(jsonl, path.join(storage, name, 'files.jsonl'));
    }
    for (const name of ['circle-main-catalog.json', 'circle-new-catalog.json', 'circle-hd-catalog.json']) {
      add(json, path.join(root, name));
    }
  }

  for (const raw of String(process.env.STREAMVAULT_SEARCH_CATALOGS || '').split(';').map(v => v.trim()).filter(Boolean)) {
    if (raw.toLowerCase().endsWith('.jsonl')) add(jsonl, raw);
    else add(json, raw);
  }

  return { jsonl: jsonl.sort(), json: json.sort() };
}

function latestMtime(files) {
  let latest = 0;
  for (const file of files) {
    try { latest = Math.max(latest, fs.statSync(file).mtimeMs || 0); } catch {}
  }
  return latest;
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const url = String(record.url || record.streamUrl || record.href || '').trim();
  if (!/^https?:\/\//i.test(url) || !VIDEO_EXT_RE.test(url)) return null;
  return {
    url,
    title: String(record.title || record.name || record.filename || fileTitleFromUrl(url) || '').trim(),
    type: record.type || 'video'
  };
}

async function writeRecord(out, record, state) {
  const normalized = normalizeRecord(record);
  if (!normalized || state.seen.has(normalized.url)) return;
  state.seen.add(normalized.url);
  const chunk = `${state.first ? '' : ',\n'}${JSON.stringify(normalized)}`;
  state.first = false;
  state.count++;
  if (!out.write(chunk)) await once(out, 'drain');
}

async function consumeJsonl(file, out, state) {
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let lines = 0;
  let invalid = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    lines++;
    try { await writeRecord(out, JSON.parse(line), state); }
    catch { invalid++; }
  }
  return { file, lines, invalid };
}

function flattenJson(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw.files)) return raw.files;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.entries)) return raw.entries;
  const merged = [];
  if (Array.isArray(raw.movies)) merged.push(...raw.movies);
  if (Array.isArray(raw.series)) {
    for (const show of raw.series) {
      if (show?.streamUrl || show?.url) merged.push(show);
      for (const season of show?.seasons || []) {
        for (const ep of season?.episodes || []) merged.push(ep);
      }
    }
  }
  return merged;
}

async function consumeJson(file, out, state) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { return { file, records: 0, error: error.message }; }
  const records = flattenJson(raw);
  for (const record of records) await writeRecord(out, record, state);
  return { file, records: records.length };
}

function previousBuildMatches(sourceFiles) {
  try {
    const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    const previous = Array.isArray(status.sources) ? status.sources.map(v => path.resolve(String(v))).sort() : [];
    const current = sourceFiles.map(v => path.resolve(String(v))).sort();
    return previous.length > 0 && previous.length === current.length && previous.every((v, i) => v === current[i]);
  } catch {
    return false;
  }
}

async function buildRuntimeSearchCatalog(options = {}) {
  const force = options.force === true || process.env.STREAMVAULT_REBUILD_SEARCH_CATALOG === '1';
  const sources = discoverSources();
  const sourceFiles = [...sources.jsonl, ...sources.json];

  if (!sourceFiles.length) {
    console.warn('[Search Catalog] No CircleFTP crawler files found; keeping any existing clean catalog.');
    return { ok: fs.existsSync(OUT_FILE), skipped: true, reason: 'no-sources', output: OUT_FILE };
  }

  const newestSource = latestMtime(sourceFiles);
  try {
    const stat = fs.statSync(OUT_FILE);
    if (!force && previousBuildMatches(sourceFiles) && stat.size > 1024 && stat.mtimeMs >= newestSource) {
      console.log(`[Search Catalog] Current catalog is fresh (${(stat.size / 1024 / 1024).toFixed(1)} MB).`);
      return { ok: true, skipped: true, reason: 'fresh', output: OUT_FILE, sources: sourceFiles.length };
    }
  } catch {}

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = `${OUT_FILE}.tmp-${process.pid}`;
  const out = fs.createWriteStream(tmp, { encoding: 'utf8' });
  const state = { first: true, count: 0, seen: new Set() };
  const details = [];
  out.write('[\n');

  try {
    for (const file of sources.jsonl) {
      console.log(`[Search Catalog] Reading ${file}`);
      details.push(await consumeJsonl(file, out, state));
    }
    for (const file of sources.json) {
      console.log(`[Search Catalog] Reading ${file}`);
      details.push(await consumeJson(file, out, state));
    }
    out.end('\n]\n');
    await finished(out);
    fs.renameSync(tmp, OUT_FILE);

    const status = {
      ok: true,
      builtAt: new Date().toISOString(),
      output: OUT_FILE,
      mediaUrls: state.count,
      sources: sourceFiles,
      details
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    console.log(`[Search Catalog] Ready: ${state.count.toLocaleString()} media URLs from ${sourceFiles.length} crawler files.`);
    return status;
  } catch (error) {
    try { out.destroy(); } catch {}
    try { fs.rmSync(tmp, { force: true }); } catch {}
    console.error('[Search Catalog] Build failed:', error.stack || error.message);
    throw error;
  }
}

module.exports = { buildRuntimeSearchCatalog, discoverSources, OUT_FILE };

if (require.main === module) {
  buildRuntimeSearchCatalog({ force: process.argv.includes('--force') })
    .then(result => { if (!result.ok) process.exitCode = 2; })
    .catch(() => { process.exitCode = 1; });
}
