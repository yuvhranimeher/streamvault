const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_FRONTEND_URL = 'https://streamvault.fit/';
const BACKEND_ORIGIN = 'https://backend.streamvault.fit';
const DEFAULT_OUTPUT = path.join(__dirname, 'home-snapshot-76d0639-20260717.js');
const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);
const REQUIRED_MARVEL_PREFIX = [
  'avengers endgame',
  'avengers infinity war',
  'the avengers',
  'avengers age of ultron',
  'iron man',
  'iron man 2',
  'iron man 3'
];
const FORBIDDEN_ARTWORK = /backend\.streamvault\.fit|\/poster-cache(?:[/?#]|$)|localhost|127\.0\.0\.1|(?:^|[\\/])[A-Za-z]:[\\/]|(?:ftp|sftp):\/\//i;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value)
    .filter(key => !/^_(?:sv|priorityImage|immediateImage|hero)/.test(key))
    .sort()
    .map(key => [key, canonicalize(value[key])]));
}

function stableJson(value, spacing = 2) {
  return JSON.stringify(canonicalize(value), null, spacing);
}

function cleanTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBrowserExecutable() {
  const executable = EDGE_CANDIDATES.find(candidate => fs.existsSync(candidate));
  if (!executable) throw new Error('Microsoft Edge or Google Chrome was not found');
  return executable;
}

async function waitForFile(filename, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(filename)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${filename}`);
}

class CdpConnection {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.opened = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('Browser connection closed'));
      this.pending.clear();
    });
  }

  async send(method, params = {}) {
    await this.opened;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  once(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const listeners = this.listeners.get(method) || [];
      const cleanup = () => {
        clearTimeout(timer);
        const current = this.listeners.get(method) || [];
        this.listeners.set(method, current.filter(listener => listener !== handler));
      };
      const handler = params => {
        cleanup();
        resolve(params);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      listeners.push(handler);
      this.listeners.set(method, listeners);
    });
  }

  on(method, handler) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(handler);
    this.listeners.set(method, listeners);
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(cdp, expression, { awaitPromise = true, returnByValue = true } = {}) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue,
    userGesture: false
  });
  if (result.exceptionDetails) {
    const message = result.exceptionDetails.exception?.description
      || result.exceptionDetails.text
      || 'Browser evaluation failed';
    throw new Error(message);
  }
  return result.result?.value;
}

async function waitForExpression(cdp, expression, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, expression)) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

async function launchBrowser({ blockBackend = false } = {}) {
  const executable = findBrowserExecutable();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'streamvault-home-capture-'));
  const stderr = [];
  const child = spawn(executable, [
    '--headless=new',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    '--disable-gpu',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-default-browser-check',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank'
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true
  });
  child.stderr.on('data', chunk => {
    if (stderr.join('').length < 12000) stderr.push(String(chunk));
  });

  const activePortFile = path.join(profile, 'DevToolsActivePort');
  await waitForFile(activePortFile);
  const [port] = fs.readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const target = targets.find(item => item.type === 'page');
  if (!target) throw new Error('No browser page target was available');
  const cdp = new CdpConnection(target.webSocketDebuggerUrl);
  await cdp.opened;
  await Promise.all([
    cdp.send('Page.enable'),
    cdp.send('Runtime.enable'),
    cdp.send('Network.enable')
  ]);
  await Promise.all([
    cdp.send('Network.setCacheDisabled', { cacheDisabled: true }),
    cdp.send('Network.setBypassServiceWorker', { bypass: true }),
    cdp.send('Network.clearBrowserCache'),
    cdp.send('Network.clearBrowserCookies')
  ]);
  if (blockBackend) {
    await cdp.send('Network.setBlockedURLs', { urls: [`${BACKEND_ORIGIN}/*`] });
  }

  return {
    cdp,
    child,
    profile,
    stderr,
    async close() {
      cdp.close();
      if (!child.killed) child.kill();
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        delay(2500)
      ]);
      fs.rmSync(profile, { recursive: true, force: true });
    }
  };
}

async function captureRenderedHomepage(options = {}) {
  const url = options.url || DEFAULT_FRONTEND_URL;
  const browser = await launchBrowser({ blockBackend: options.blockBackend });
  const consoleErrors = [];
  const failedRequests = [];
  const backendRequests = [];
  browser.cdp.on('Runtime.consoleAPICalled', params => {
    if (params.type === 'error') {
      consoleErrors.push((params.args || []).map(arg => arg.value || arg.description || '').join(' '));
    }
  });
  browser.cdp.on('Network.loadingFailed', params => {
    failedRequests.push({ errorText: params.errorText, blockedReason: params.blockedReason || '' });
  });
  browser.cdp.on('Network.requestWillBeSent', params => {
    if (String(params.request?.url || '').startsWith(BACKEND_ORIGIN)) {
      backendRequests.push(params.request.url);
    }
  });

  try {
    const origin = new URL(url).origin;
    await browser.cdp.send('Storage.clearDataForOrigin', {
      origin,
      storageTypes: 'all'
    });
    const loaded = browser.cdp.once('Page.loadEventFired', 60000);
    await browser.cdp.send('Page.navigate', { url });
    await loaded;
    await waitForExpression(
      browser.cdp,
      `typeof window.svMountHomeRow === 'function' && document.querySelectorAll('#mainSection > .row[data-section-key]').length >= 40`,
      60000
    );

    const capture = await evaluate(browser.cdp, `(async () => {
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      const rows = () => Array.from(document.querySelectorAll('#mainSection > .row[data-section-key]'));
      const rowTrack = row => row.querySelector('.cards-track');
      for (let pass = 0; pass < 4; pass += 1) {
        for (const row of rows()) {
          row.scrollIntoView({ block: 'center', behavior: 'instant' });
          await delay(180);
        }
        await delay(1500);
        const pending = rows().filter(row => {
          const track = rowTrack(row);
          const visible = getComputedStyle(row).display !== 'none';
          return visible && (!row._svFresh || !Array.isArray(track?._svItems) || !track._svItems.length);
        });
        if (!pending.length) break;
      }

      for (const row of rows()) {
        const track = rowTrack(row);
        if (!track || !Array.isArray(track._svItems) || !track._svItems.length) continue;
        if (!row._svLoaded) window.svMountHomeRow?.(row.id);
        let guard = 0;
        while ((track._svRendered || 0) < track._svItems.length && guard < 100) {
          window.svAppendLazyTrack?.(track, track._svItems.length);
          guard += 1;
        }
      }
      await delay(500);

      return rows()
        .filter(row => getComputedStyle(row).display !== 'none')
        .map(row => {
          const track = rowTrack(row);
          const items = Array.isArray(track?._svItems)
            ? JSON.parse(JSON.stringify(track._svItems))
            : [];
          const itemKeys = Array.isArray(track?._svItemKeys) ? [...track._svItemKeys] : [];
          const domKeys = Array.from(track?.querySelectorAll('.card,.live-ch-card') || [])
            .map(card => card.dataset.svKey || '');
          return {
            rowId: row.id,
            sectionKey: row.dataset.sectionKey || '',
            title: row.querySelector('.row-title')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
            fresh: row._svFresh === true,
            items,
            itemKeys,
            domKeys
          };
        });
    })()`);

    if (!capture.length) throw new Error('The live homepage produced no feed rows');
    const notFresh = capture.filter(row => !row.fresh).map(row => row.rowId);
    if (!options.blockBackend && notFresh.length) {
      throw new Error(`Live rows were not refreshed from section APIs: ${notFresh.join(', ')}`);
    }
    for (const row of capture) {
      if (!row.items.length) throw new Error(`Rendered row ${row.rowId} has no items`);
      if (row.domKeys.length !== row.items.length) {
        throw new Error(`DOM card count mismatch in ${row.rowId}: ${row.domKeys.length} != ${row.items.length}`);
      }
      if (row.itemKeys.length !== row.items.length) {
        throw new Error(`Runtime item-key count mismatch in ${row.rowId}`);
      }
      if (row.domKeys.some((key, index) => key !== row.itemKeys[index])) {
        throw new Error(`DOM card ordering mismatch in ${row.rowId}`);
      }
      for (const item of row.items) {
        if (!item?.id) throw new Error(`Missing stable media ID in ${row.rowId}`);
        for (const artwork of [item.poster, item.backdrop].filter(Boolean)) {
          if (FORBIDDEN_ARTWORK.test(String(artwork))) {
            throw new Error(`Backend-dependent artwork in ${row.rowId}: ${artwork}`);
          }
        }
      }
    }

    return {
      url,
      rows: capture,
      backendRequests: [...new Set(backendRequests)],
      consoleErrors,
      failedRequests
    };
  } catch (error) {
    const browserError = browser.stderr.join('').trim();
    if (browserError) error.message += `\nBrowser output: ${browserError.slice(-4000)}`;
    throw error;
  } finally {
    await browser.close();
  }
}

async function fetchBackendVersion() {
  const response = await fetch(`${BACKEND_ORIGIN}/api/version`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Backend version HTTP ${response.status}`);
  return response.json();
}

function validateCurrentRows(rows) {
  const marvel = rows.find(row => row.rowId === 'marvelRow');
  if (!marvel) throw new Error('The live DOM has no Marvel row');
  const actual = marvel.items.slice(0, REQUIRED_MARVEL_PREFIX.length)
    .map(item => cleanTitle(item.name || item.title));
  if (actual.some((title, index) => title !== REQUIRED_MARVEL_PREFIX[index])) {
    throw new Error(`Marvel source-of-truth prefix mismatch: ${actual.join(' | ')}`);
  }
}

function snapshotItem(item) {
  const requiredKeys = [
    'id',
    'name',
    'title',
    'year',
    'rating',
    'type',
    'poster',
    'backdrop'
  ];
  const optionalKeys = [
    'displayTitle',
    'mediaType',
    'tmdbId',
    'genre',
    'sectionKey',
    'streamAvailable',
    'hasStream',
    'isFtp',
    'isSummary',
    'seasonCount',
    'episodeCount'
  ];
  return {
    ...Object.fromEntries(requiredKeys.map(key => [key, item[key] ?? null])),
    ...Object.fromEntries(optionalKeys
    .filter(key => Object.prototype.hasOwnProperty.call(item, key))
    .map(key => [key, item[key]]))
  };
}

function buildSnapshot(capture, backend) {
  const rows = capture.rows.map(row => ({
    rowId: row.rowId,
    sectionKey: row.sectionKey,
    title: row.title,
    items: row.items.map(snapshotItem)
  }));
  validateCurrentRows(rows);
  const feed = canonicalize({
    ok: true,
    schemaVersion: 1,
    source: {
      frontendCommit: '76d0639660345cdbd3c0b675bdf25ed944be7bd1',
      frontendOrigin: new URL(capture.url).origin,
      backendCommit: backend.commit || '',
      backendBuild: backend.build || '',
      backendOrigin: BACKEND_ORIGIN,
      capture: 'rendered production DOM with fresh browser storage, cache disabled, and service workers bypassed'
    },
    hero: [],
    rows
  });
  const contentHash = crypto.createHash('sha256').update(stableJson(feed, 0)).digest('hex');
  return canonicalize({
    ...feed,
    snapshotId: `production-${contentHash.slice(0, 20)}`,
    contentHash
  });
}

function writeSnapshotModule(filename, snapshot) {
  const source = [
    '(function installStreamVaultHomeSnapshot(global) {',
    "  'use strict';",
    `  global.STREAMVAULT_HOME_SNAPSHOT = Object.freeze(${stableJson(snapshot, 2)});`,
    '})(window);',
    ''
  ].join('\n');
  fs.writeFileSync(filename, source);
}

function readSnapshotModule(filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const prefix = 'global.STREAMVAULT_HOME_SNAPSHOT = Object.freeze(';
  const start = source.indexOf(prefix);
  const end = source.lastIndexOf('\n})(window);');
  if (start < 0 || end < 0) throw new Error(`Invalid snapshot module: ${filename}`);
  let json = source.slice(start + prefix.length, end).trim();
  if (json.endsWith(');')) json = json.slice(0, -2).trim();
  return JSON.parse(json);
}

async function startProxyServer(root, upstream = DEFAULT_FRONTEND_URL) {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      const relative = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
      const candidate = path.resolve(root, relative || 'index.html');
      const insideRoot = candidate === path.resolve(root) || candidate.startsWith(path.resolve(root) + path.sep);
      if (insideRoot && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const extension = path.extname(candidate).toLowerCase();
        const contentTypes = {
          '.css': 'text/css; charset=utf-8',
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp',
          '.webmanifest': 'application/manifest+json'
        };
        response.writeHead(200, {
          'Content-Type': contentTypes[extension] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(candidate).pipe(response);
        return;
      }

      const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, upstream);
      const upstreamResponse = await fetch(upstreamUrl, { redirect: 'manual', cache: 'no-store' });
      const headers = Object.fromEntries(upstreamResponse.headers.entries());
      delete headers['content-encoding'];
      delete headers['content-length'];
      headers['cache-control'] = 'no-store';
      response.writeHead(upstreamResponse.status, headers);
      response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch (error) {
      response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.stack || error.message);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url || DEFAULT_FRONTEND_URL;
  const output = path.resolve(args.output || DEFAULT_OUTPUT);
  const [capture, backend] = await Promise.all([
    captureRenderedHomepage({ url }),
    fetchBackendVersion()
  ]);
  const snapshot = buildSnapshot(capture, backend);
  writeSnapshotModule(output, snapshot);
  console.log(`Captured ${snapshot.rows.length} production rows and ${snapshot.rows.reduce((count, row) => count + row.items.length, 0)} cards`);
  console.log(`Snapshot ${snapshot.snapshotId}: ${output}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  BACKEND_ORIGIN,
  DEFAULT_FRONTEND_URL,
  buildSnapshot,
  captureRenderedHomepage,
  readSnapshotModule,
  snapshotItem,
  stableJson,
  startProxyServer,
  validateCurrentRows,
  writeSnapshotModule
};
