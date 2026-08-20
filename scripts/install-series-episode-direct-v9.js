'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'SV_SERIES_EPISODE_DIRECT_V9';

function install() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  let source = fs.readFileSync(serverPath, 'utf8');
  if (source.includes(MARKER)) return false;

  // V7 can only upgrade an existing direct route. A clean checkout has no
  // direct route, so bootstrap V5 first and then upgrade it to V7.
  if (!source.includes('SV_SERIES_EPISODE_DIRECT_V7')) {
    if (!source.includes("app.get('/api/series/episodes-direct'")) {
      require('./install-series-episode-direct-v5').install();
    }
    require('./install-series-episode-direct-v7').install();
    source = fs.readFileSync(serverPath, 'utf8');
  }

  const routeNeedle = "app.get('/api/series/episodes-direct', (req, res) => {";
  const routeAt = source.indexOf(routeNeedle);
  if (routeAt < 0 || !source.includes('function svDirectBuildEpisodeIndexV7()')) {
    throw new Error('Could not locate the V7 direct episode authority');
  }

  const warmup = `// ${MARKER}\n// Build the global title map before Express starts listening. Uncached titles\n// must never pay the cost of parsing the massive catalog inside a 7s request.\nconst svDirectEpisodeWarmupV9 = (() => {\n  const startedAt = Date.now();\n  try {\n    const index = svDirectBuildEpisodeIndexV7();\n    console.log('[Startup] Global series episode index ready: ' + index.size + ' titles in ' + (Date.now() - startedAt) + 'ms');\n    return { ok: true, titles: index.size, elapsedMs: Date.now() - startedAt };\n  } catch (error) {\n    console.error('[Startup] Global series episode index failed:', error.stack || error.message);\n    return { ok: false, titles: 0, elapsedMs: Date.now() - startedAt, error: error.message };\n  }\n})();\n\n`;

  source = source.slice(0, routeAt) + warmup + source.slice(routeAt);
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[Startup] Installed prewarmed global series episode authority V9.');
  return true;
}

if (require.main === module) {
  try { install(); }
  catch (error) {
    console.error('[Series episode direct V9] install failed:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { install };
