'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SERVER = path.join(ROOT, 'server.js');
const BACKUP = path.join(ROOT, 'server.js.before-search-authority-v1.bak');
const MARKER = 'SV_SEARCH_AUTHORITY_BACKEND_V1';

function findSearchRoute(source) {
  const exact = "app.get('/api/search', (req, res) => {";
  const index = source.indexOf(exact);
  if (index >= 0) return index;
  const match = /app\.get\(\s*['\"]\/api\/search['\"]\s*,\s*\(req\s*,\s*res\)\s*=>\s*\{/m.exec(source);
  return match ? match.index : -1;
}

if (!fs.existsSync(SERVER)) throw new Error(`server.js not found in ${ROOT}`);
let source = fs.readFileSync(SERVER, 'utf8');
if (!fs.existsSync(BACKUP)) fs.copyFileSync(SERVER, BACKUP);

if (!source.includes(MARKER)) {
  const index = findSearchRoute(source);
  if (index < 0) throw new Error('Could not find existing /api/search route; server.js was not modified');

  const hook = String.raw`
/* ${MARKER}
 * One authoritative media search path.
 * Coverage: local file index, FTP catalog.json, Circle/runtime massive clean-catalog,
 * and the persisted boot search index as a fallback/coverage supplement.
 * This route intentionally shadows the older /api/search handler below it.
 */
function svAuthoritySearchKind(req) {
  const raw = String(req.query.kind || req.query.type || 'mixed').toLowerCase();
  if (raw === 'movie' || raw === 'movies') return 'movie';
  if (raw === 'series' || raw === 'tv' || raw === 'show' || raw === 'shows') return 'series';
  return 'mixed';
}

function svAuthoritySearchKey(item) {
  const kind = (item && (item.type === 'series' || item.type === 'tv' || item._isSeries || item.seasons)) ? 'series' : 'movie';
  const stream = String(item?.streamUrl || item?.url || '');
  if (stream) return kind + '|url|' + stream.toLowerCase();
  const id = String(item?.id ?? '');
  if (id) return kind + '|id|' + id.toLowerCase();
  const name = svNormalizeSearchText(item?.name || item?.title || item?.file || '');
  const year = String(item?.year || '').match(/(?:19|20)\d{2}/)?.[0] || '';
  return kind + '|title|' + name + '|' + year;
}

function svAuthoritySearchVariants(query) {
  const clean = svNormalizeSearchText(query);
  if (!clean) return [];
  const out = [clean];
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length) {
    const last = parts[parts.length - 1];
    if (last.length >= 4) {
      if (last.endsWith('s')) {
        const copy = parts.slice();
        copy[copy.length - 1] = last.slice(0, -1);
        out.push(copy.join(' '));
      } else {
        const copy = parts.slice();
        copy[copy.length - 1] = last + 's';
        out.push(copy.join(' '));
      }
    }
  }
  return [...new Set(out)];
}

function svAuthoritySearchRequest(req, q) {
  return { ...req, query: { ...req.query, q, massive: '1', background: '1' } };
}

app.get('/api/search-authority/status', (req, res) => {
  try {
    loadMassiveCatalog();
    const index = svGetFastSearchIndex();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      version: '20260819-search-authority-v1',
      indexedItems: index?.entries?.length || 0,
      massiveMovies: Array.isArray(_massiveMovies) ? _massiveMovies.length : 0,
      massiveSeries: Array.isArray(_massiveSeries) ? _massiveSeries.length : 0,
      ftpMovies: getCachedMovies().length,
      ftpSeries: getCachedSeries().length,
      localMovies: (_movieList || []).length,
      localSeries: (_seriesList || []).length,
      fuzzy: true,
      prefix: true,
      typoTolerance: true,
      source: 'local+ftp+massive+boot'
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/search', (req, res, next) => {
  if (String(req.query.legacySearch || '') === '1') return next();
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(120, Math.max(1, parseInt(req.query.limit || '72', 10) || 72));
    if (q.length < 2) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ items: [], total: 0, page, pages: 0, authority: true, version: '20260819-search-authority-v1' });
    }

    const kind = svAuthoritySearchKind(req);
    const variants = svAuthoritySearchVariants(q);
    const merged = [];
    const seen = new Set();
    const append = items => {
      for (const item of Array.isArray(items) ? items : []) {
        if (!item) continue;
        const key = svAuthoritySearchKey(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
    };

    // The fast index already covers local media, catalog.json FTP media and the
    // Circle/runtime massive catalog. It performs exact, prefix and fuzzy token matching.
    for (const variant of variants) {
      append(svFastSearch(svAuthoritySearchRequest(req, variant), kind) || []);
      if (merged.length >= Math.max(limit * 4, 240)) break;
    }

    // Merge boot-index results only as supplemental coverage. They never replace
    // authoritative full-catalog matches and cannot erase them.
    try {
      const boot = svQueryBootSearchPaged(q, kind, Math.min(240, Math.max(limit * 2, 120)), 1);
      append(boot?.items || []);
    } catch (_) {}

    const start = (page - 1) * limit;
    const items = merged.slice(start, start + limit);
    const total = merged.length;
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      items,
      total,
      page,
      pages: total ? Math.ceil(total / limit) : 0,
      authority: true,
      indexed: true,
      massive: true,
      fuzzy: true,
      source: 'authority',
      version: '20260819-search-authority-v1'
    });
  } catch (error) {
    console.error('[Search Authority] request failed:', error.stack || error.message);
    // The old handler remains physically below this route as an emergency escape hatch.
    return next();
  }
});

const svAuthorityWarmTimer = setTimeout(() => {
  try {
    loadMassiveCatalog();
    const index = svBuildFastSearchIndex();
    console.log('[Search Authority] warm index ready:', index?.entries?.length || 0, 'items');
  } catch (error) {
    console.error('[Search Authority] warmup failed:', error.message);
  }
}, 1200);
svAuthorityWarmTimer.unref?.();

`;

  source = source.slice(0, index) + hook + source.slice(index);
  fs.writeFileSync(SERVER, source, 'utf8');
}

console.log('[Search Authority] backend patch installed');
console.log(`[Search Authority] backup: ${BACKUP}`);
