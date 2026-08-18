'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = process.cwd();
const SERVER = path.join(ROOT, 'server.js');
const LIB_DIR = path.join(ROOT, 'lib');
const LIB_FILE = path.join(LIB_DIR, 'mobile-direct.js');
const BACKUP = path.join(ROOT, 'server.js.before-mobile-direct-v1.bak');
const MARKER = 'SV_MOBILE_DIRECT_V1_INSTALL';
const MODULE_URL = 'https://raw.githubusercontent.com/yuvhranimeher/streamvault/023ad9ddfd16ad9f5ad6f4a5b8f6116dc54d3b27/lib/mobile-direct.js';

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 4) return reject(new Error('Too many redirects'));
    https.get(url, { headers: { 'User-Agent': 'StreamVault-Installer/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return download(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function find404Index(source) {
  const exact = [
    "app.use((req, res) => res.status(404).json({ error: 'Not found' }));",
    'app.use((req, res) => res.status(404).json({ error: "Not found" }));'
  ];
  for (const text of exact) {
    const idx = source.indexOf(text);
    if (idx >= 0) return idx;
  }
  const re = /app\.use\(\s*\(req\s*,\s*res\)\s*=>\s*res\.status\(404\)\.json\(\s*\{\s*error\s*:\s*['\"]Not found['\"]\s*\}\s*\)\s*\)\s*;?/m;
  const match = re.exec(source);
  return match ? match.index : -1;
}

(async () => {
  if (!fs.existsSync(SERVER)) throw new Error(`server.js not found in ${ROOT}`);
  fs.mkdirSync(LIB_DIR, { recursive: true });

  const moduleSource = await download(MODULE_URL);
  if (!moduleSource.includes('installMobileDirect') || !moduleSource.includes('20260819-mobile-direct-v1')) {
    throw new Error('Downloaded mobile-direct module failed validation');
  }
  fs.writeFileSync(LIB_FILE, moduleSource, 'utf8');

  let source = fs.readFileSync(SERVER, 'utf8');
  if (!fs.existsSync(BACKUP)) fs.copyFileSync(SERVER, BACKUP);

  if (!source.includes(MARKER)) {
    const index = find404Index(source);
    if (index < 0) throw new Error('Final 404 handler not found; server.js was not modified');
    const hook = `\n/* ${MARKER} */\ntry {\n  require('./lib/mobile-direct').installMobileDirect({\n    app,\n    cacheDir: SV_CACHE_DIR,\n    getMediaInfo: getCachedMediaInfo,\n    getMovies: allApiMoviesForDetails,\n    getSeries: allApiSeriesForDetails\n  });\n} catch (error) {\n  console.error('[Mobile Direct] install failed:', error.message);\n}\n\n`;
    source = source.slice(0, index) + hook + source.slice(index);
    fs.writeFileSync(SERVER, source, 'utf8');
  }

  console.log('[Mobile Direct] backend installation complete');
  console.log(`[Mobile Direct] module: ${LIB_FILE}`);
  console.log(`[Mobile Direct] backup: ${BACKUP}`);
})();
