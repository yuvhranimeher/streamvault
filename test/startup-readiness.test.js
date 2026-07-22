'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function request(port, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method: 'GET', headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
        json() { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      }));
    });
    req.once('error', reject);
    req.setTimeout(1000, () => req.destroy(new Error('request timed out')));
    req.end();
  });
}

async function waitForRoute(port, pathname, timeoutMs = 5000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await request(port, pathname);
      return { response, elapsedMs: Date.now() - startedAt };
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  throw lastError || new Error(`${pathname} did not become reachable`);
}

async function startFixture({ corruptIndex = false, indexOnlyBackground = false } = {}) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'streamvault-startup-'));
  const mediaRoot = path.join(fixture, 'media');
  const movies = path.join(mediaRoot, 'movies');
  const series = path.join(mediaRoot, 'series');
  fs.mkdirSync(movies, { recursive: true });
  fs.mkdirSync(series, { recursive: true });
  fs.writeFileSync(path.join(movies, 'alpha.mp4'), Buffer.from('AAAAAAAAAA'));
  fs.writeFileSync(path.join(movies, 'beta.mp4'), Buffer.from('BBBBBBBBBB'));
  fs.writeFileSync(path.join(movies, 'gamma.mp4'), Buffer.from('GGGGGGGGGG'));

  const channelsFile = path.join(fixture, 'channels.json');
  fs.writeFileSync(channelsFile, JSON.stringify([
    { id: 'test-live', name: 'Test Live', url: 'https://example.test/live.m3u8' }
  ]));
  const indexFile = path.join(fixture, 'file-index.json');
  if (corruptIndex) {
    fs.writeFileSync(indexFile, '{not valid json');
  } else {
    // Deliberately reverse lexical order. If startup scans/reassigns IDs before
    // listening, ID 0 would point at alpha.mp4 instead of the persisted beta.mp4.
    fs.writeFileSync(indexFile, JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: [
        { dir: movies, file: 'beta.mp4', type: 'movie' },
        { dir: movies, file: 'alpha.mp4', type: 'movie' }
      ]
    }));
  }

  const port = await availablePort();
  const output = [];
  const startedAt = Date.now();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      SV_PORT: String(port),
      SV_MEDIA_ROOT: mediaRoot,
      SV_FILE_INDEX_PATH: indexFile,
      SV_CHANNELS_PATH: channelsFile,
      ...(indexOnlyBackground ? { SV_FILE_INDEX_ONLY: '1' } : { SV_SKIP_BACKGROUND_JOBS: '1' }),
      FFMPEG_BIN: 'streamvault-test-ffmpeg-must-not-run',
      FFPROBE_BIN: 'streamvault-test-ffprobe-must-not-run'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  child.stdout.on('data', data => output.push(String(data)));
  child.stderr.on('data', data => output.push(String(data)));
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  const ready = await Promise.race([
    waitForRoute(port, '/api/ready'),
    exited.then(result => { throw new Error(`server exited before readiness: ${JSON.stringify(result)}\n${output.join('')}`); })
  ]);
  return {
    child,
    fixture,
    indexFile,
    output,
    port,
    processToReadyMs: Date.now() - startedAt,
    readyRouteMs: ready.elapsedMs,
    async stop() {
      if (child.exitCode == null) child.kill();
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2000))]);
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  };
}

test('persisted index enables immediate readiness, stable IDs, direct plans, and byte ranges', async t => {
  const fixture = await startFixture();
  t.after(() => fixture.stop());

  const readyResponse = await request(fixture.port, '/api/ready');
  assert.equal(readyResponse.status, 200);
  assert.equal(readyResponse.headers['cache-control'], 'no-store');
  const ready = readyResponse.json();
  assert.equal(ready.reachable, true);
  assert.equal(ready.listening, true);
  assert.equal(ready.fileIndexLoaded, true);
  assert.equal(ready.playbackReady, true);
  assert.equal(ready.liveReady, true);
  assert.equal(ready.catalogReady, false, 'Live TV should be ready before catalog warmup');
  assert.equal(ready.searchReady, false);
  for (const forbidden of ['path', 'environment', 'token', 'credential', 'upstream']) {
    assert(!JSON.stringify(ready).toLowerCase().includes(forbidden));
  }

  const versionStarted = Date.now();
  const versionResponse = await request(fixture.port, '/api/version');
  const versionMs = Date.now() - versionStarted;
  assert.equal(versionResponse.status, 200);
  assert.equal(versionResponse.headers['cache-control'], 'no-store');
  assert.equal(typeof versionResponse.json().version, 'string');

  const planStarted = Date.now();
  const planResponse = await request(fixture.port, '/api/playback/local/0', { 'User-Agent': 'Desktop Test' });
  const planMs = Date.now() - planStarted;
  assert.equal(planResponse.status, 200, fixture.output.join(''));
  const plan = planResponse.json();
  assert.match(plan.src, /^\/stream\/0(?:\?|$)/);
  assert(planMs < 1000, `direct desktop plan was delayed: ${planMs}ms`);

  const rangeResponse = await request(fixture.port, '/api/playback/local/0/stream', {
    Range: 'bytes=2-5',
    'User-Agent': 'Desktop Test'
  });
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeResponse.headers['content-range'], 'bytes 2-5/10');
  assert.equal(rangeResponse.headers['content-length'], '4');
  assert.equal(rangeResponse.body.toString(), 'BBBB', 'persisted stable ID 0 no longer points at beta.mp4');

  const channelsResponse = await request(fixture.port, '/api/channels');
  assert.equal(channelsResponse.status, 200);
  assert.equal(channelsResponse.json()[0].id, 'test-live');

  console.log(JSON.stringify({
    startup: fixture.processToReadyMs,
    ready: fixture.readyRouteMs,
    version: versionMs,
    desktopPlan: planMs
  }));
});

test('corrupt persisted index does not crash and only index-backed playback returns 503', async t => {
  const fixture = await startFixture({ corruptIndex: true });
  t.after(() => fixture.stop());

  const ready = (await request(fixture.port, '/api/ready')).json();
  assert.equal(ready.listening, true);
  assert.equal(ready.liveReady, true);
  assert.equal(ready.catalogReady, false);
  assert.equal(ready.fileIndexLoaded, false);
  assert.equal(ready.playbackReady, false);

  const playback = await request(fixture.port, '/api/playback/local/0');
  assert.equal(playback.status, 503);
  assert.equal(playback.json().code, 'PLAYBACK_INDEX_REBUILDING');
  assert.equal(playback.headers['retry-after'], '1');

  const channelsResponse = await request(fixture.port, '/api/channels');
  assert.equal(channelsResponse.status, 200, 'Live TV routes depended on the file index');
  const versionResponse = await request(fixture.port, '/api/version');
  assert.equal(versionResponse.status, 200);
});

test('background rebuild validates and atomically publishes a complete index', async t => {
  const fixture = await startFixture({ corruptIndex: true, indexOnlyBackground: true });
  t.after(() => fixture.stop());

  const startedAt = Date.now();
  let ready;
  while (Date.now() - startedAt < 3000) {
    ready = (await request(fixture.port, '/api/ready')).json();
    if (ready.playbackReady) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.equal(ready.playbackReady, true, fixture.output.join(''));
  assert.equal(ready.fileIndexLoaded, true);

  const persisted = JSON.parse(fs.readFileSync(fixture.indexFile, 'utf8'));
  assert.equal(persisted.version, 1);
  assert.deepEqual(persisted.entries.map(entry => entry.file), ['alpha.mp4', 'beta.mp4', 'gamma.mp4']);
  assert(!fs.readdirSync(path.dirname(fixture.indexFile)).some(name => name.startsWith('file-index.json.tmp-')));

  const rangeResponse = await request(fixture.port, '/stream/0', {
    Range: 'bytes=0-3',
    'User-Agent': 'Desktop Test'
  });
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeResponse.body.toString(), 'AAAA');
});

test('background refresh appends discoveries without changing persisted playback IDs', async t => {
  const fixture = await startFixture({ indexOnlyBackground: true });
  t.after(() => fixture.stop());

  const startedAt = Date.now();
  let persisted;
  while (Date.now() - startedAt < 3000) {
    persisted = JSON.parse(fs.readFileSync(fixture.indexFile, 'utf8'));
    if (persisted.entries.length === 3) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.deepEqual(persisted.entries.map(entry => entry.file), ['beta.mp4', 'alpha.mp4', 'gamma.mp4']);

  const rangeResponse = await request(fixture.port, '/stream/0', {
    Range: 'bytes=0-3',
    'User-Agent': 'Desktop Test'
  });
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeResponse.body.toString(), 'BBBB');
});
