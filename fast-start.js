'use strict';

// Production launcher that preserves server.js as the source of truth while
// moving nonessential catalog/search warmups until after Express is listening.
// This keeps local playback and live-TV routes available almost immediately
// after the Mac mini boots.

const fs = require('fs');
const path = require('path');
const Module = require('module');

const serverPath = path.join(__dirname, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');

const blockingStartup = `buildFileIndex();
buildInstantLists();                                   // ⚡ instant — sync, ~10ms
filterCartoonsAndAnime();                              // 🧹 remove cartoons/anime (with logging)
svGetBootSearchIndex();                                // instant search boot payload, no massive catalog
try { svDetailCatalogIndex(); }                        // warm playable recommendations before first detail click
catch (e) { console.warn('Detail recommendation warmup failed:', e.message); }
if (process.env.SV_SEARCH_WARMUP === '1') {
  const searchWarmupDelay = Math.max(30000, parseInt(process.env.SV_SEARCH_WARMUP_DELAY_MS || '120000', 10) || 120000);
  setTimeout(() => {
    try { svGetFastSearchIndex(); }
    catch (e) { console.warn('⚠ Search index warmup failed:', e.message); }
  }, searchWarmupDelay);
}
setTimeout(() => runBackgroundEnrichment(), 60000);    // 🔄 fill missing posters after startup settles`;

const fastStartup = `buildFileIndex();

function startDeferredProductionWarmups() {
  setImmediate(() => {
    const startedAt = Date.now();
    try { buildInstantLists(); }
    catch (e) { console.warn('Instant list warmup failed:', e.message); }
    try { filterCartoonsAndAnime(); }
    catch (e) { console.warn('Catalog filter warmup failed:', e.message); }
    try { svGetBootSearchIndex(); }
    catch (e) { console.warn('Boot search warmup failed:', e.message); }
    try { svDetailCatalogIndex(); }
    catch (e) { console.warn('Detail recommendation warmup failed:', e.message); }
    console.log('[Fast Start] Deferred core warmups completed in ' + (Date.now() - startedAt) + 'ms');
  });

  if (process.env.SV_SEARCH_WARMUP === '1') {
    const searchWarmupDelay = Math.max(30000, parseInt(process.env.SV_SEARCH_WARMUP_DELAY_MS || '120000', 10) || 120000);
    setTimeout(() => {
      try { svGetFastSearchIndex(); }
      catch (e) { console.warn('Search index warmup failed:', e.message); }
    }, searchWarmupDelay);
  }

  setTimeout(() => {
    try { runBackgroundEnrichment(); }
    catch (e) { console.warn('Background enrichment failed:', e.message); }
  }, 60000);
}`;

if (!source.includes(blockingStartup)) {
  throw new Error('fast-start.js could not locate the expected server.js startup block; refusing to start an unverified transformation');
}
source = source.replace(blockingStartup, fastStartup);

const attachLine = 'infraTelemetry.attachWebSocket(server);';
if (!source.includes(attachLine)) {
  throw new Error('fast-start.js could not locate the server attach point');
}
source = source.replace(attachLine, `${attachLine}\nstartDeferredProductionWarmups();`);

const productionModule = new Module(serverPath, module);
productionModule.filename = serverPath;
productionModule.paths = Module._nodeModulePaths(__dirname);
productionModule._compile(source, serverPath);
