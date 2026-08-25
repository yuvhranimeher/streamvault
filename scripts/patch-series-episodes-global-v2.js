'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'server.js');
let src = fs.readFileSync(file, 'utf8');
const marker = 'SV_20260818_SERIES_EPISODES_GLOBAL_V2';

if (src.includes(marker)) {
  console.log('[Series Episodes V2] already applied');
  process.exit(0);
}

let changed = false;

// 1) Make /api/series/detail able to resolve titles coming from the massive catalog.
const oldDetailsReturn = "  const seenShows = new Set(localSeries.map(s => s.name));\n  return [...localSeries, ...ftpSeries.filter(s => !seenShows.has(s.name))];";
const newDetailsReturn = `  const seenShows = new Set(localSeries.map(s => s.name));
  const baseSeries = [...localSeries, ...ftpSeries.filter(s => !seenShows.has(s.name))];

  // ${marker}: detail resolver must see every playable series source.
  loadMassiveCatalog();
  const seenDetailKeys = new Set(baseSeries.map(s => {
    const title = String(s?.name || s?.title || '').toLowerCase().replace(/\\s+/g, ' ').trim();
    return title + '|' + String(s?.year || '');
  }));
  const massiveSeries = (_massiveSeries || []).filter(s => {
    const title = String(s?.name || s?.title || '').toLowerCase().replace(/\\s+/g, ' ').trim();
    const key = title + '|' + String(s?.year || '');
    if (!title || seenDetailKeys.has(key)) return false;
    const hasEpisodes = Object.values(s?.seasons || {}).some(eps => Array.isArray(eps) && eps.length);
    if (!hasEpisodes) return false;
    seenDetailKeys.add(key);
    return true;
  });
  return [...baseSeries, ...massiveSeries];`;

if (src.includes(oldDetailsReturn)) {
  src = src.replace(oldDetailsReturn, newDetailsReturn);
  changed = true;
} else if (!src.includes(marker)) {
  // More tolerant replacement for locally modified copies.
  const fnStart = src.indexOf('function allApiSeriesForDetails()');
  if (fnStart >= 0) {
    const tail = src.slice(fnStart);
    const returnRe = /const seenShows\s*=\s*new Set\(localSeries\.map\(s\s*=>\s*s\.name\)\);\s*return\s*\[\.\.\.localSeries,\s*\.\.\.ftpSeries\.filter\(s\s*=>\s*!seenShows\.has\(s\.name\)\)\];/;
    const match = tail.match(returnRe);
    if (match) {
      const before = src.slice(0, fnStart + match.index);
      const after = src.slice(fnStart + match.index + match[0].length);
      src = before + newDetailsReturn.trimStart() + after;
      changed = true;
    }
  }
}

// 2) Ensure title-specific /api/series searches include the massive series catalog.
// Newer servers already contain this block; older locally patched servers may not.
const seriesRouteStart = src.indexOf("app.get('/api/series',");
if (seriesRouteStart >= 0) {
  const seriesRouteEnd = src.indexOf("app.get('/api/search'", seriesRouteStart);
  const route = src.slice(seriesRouteStart, seriesRouteEnd > seriesRouteStart ? seriesRouteEnd : seriesRouteStart + 12000);
  if (!route.includes('_massiveSeries') || !route.includes('loadMassiveCatalog()')) {
    const anchor = '    const ftpSeriesRaw = getCachedSeries();';
    const absoluteAnchor = src.indexOf(anchor, seriesRouteStart);
    if (absoluteAnchor >= 0 && (seriesRouteEnd < 0 || absoluteAnchor < seriesRouteEnd)) {
      const insertAt = absoluteAnchor;
      const prelude = `    // ${marker}: searched series must include massive-catalog episodes.\n    if (String(req.query.q || '').trim().length >= 2) loadMassiveCatalog();\n`;
      src = src.slice(0, insertAt) + prelude + src.slice(insertAt);
      changed = true;
    }
  }
}

if (!changed) {
  console.error('[Series Episodes V2] target blocks not found; no changes written');
  process.exit(3);
}

const backup = file + '.series-episodes-v2.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
fs.writeFileSync(file, src);
console.log('[Series Episodes V2] patched server.js');
console.log('[Series Episodes V2] backup:', backup);
