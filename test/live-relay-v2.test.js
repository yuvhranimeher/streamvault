'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const test = require('node:test');
const express = require('express');
const {
  createLiveRelayV2,
  normalizePlaylist,
  uniqueHttpSources
} = require('../lib/live-relay-v2');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fakeFfmpeg({ readyDelayMs = 15, silent = false } = {}) {
  const calls = [];
  const children = [];
  let sequence = 1000;
  let active = 0;
  let maxActive = 0;

  function spawnProcess(bin, args) {
    const child = new EventEmitter();
    child.stderr = new PassThrough();
    child.pid = 41000 + calls.length;
    child.exitCode = null;
    child.killed = false;
    child.closed = false;
    calls.push({ bin, args: [...args] });
    children.push(child);
    active += 1;
    maxActive = Math.max(maxActive, active);

    const playlistPath = args.at(-1);
    const finish = code => {
      if (child.closed) return;
      child.closed = true;
      child.exitCode = code;
      active = Math.max(0, active - 1);
      queueMicrotask(() => child.emit('close', code));
    };
    child.kill = () => {
      child.killed = true;
      finish(0);
      return true;
    };
    child.crash = (code = 1) => finish(code);

    if (!silent) {
      setTimeout(() => {
        if (child.closed) return;
        sequence += 1;
        const number = String(sequence).padStart(19, '0');
        const filename = `seg_${number}.ts`;
        fs.mkdirSync(path.dirname(playlistPath), { recursive: true });
        fs.writeFileSync(path.join(path.dirname(playlistPath), filename), Buffer.alloc(188 * 20, sequence % 255));
        fs.writeFileSync(playlistPath, [
          '#EXTM3U',
          '#EXT-X-VERSION:6',
          '#EXT-X-TARGETDURATION:2',
          `#EXT-X-MEDIA-SEQUENCE:${sequence}`,
          '#EXT-X-INDEPENDENT-SEGMENTS',
          '#EXTINF:2.000000,',
          filename,
          ''
        ].join('\n'));
      }, readyDelayMs);
    }
    return child;
  }

  return {
    spawnProcess,
    calls,
    children,
    get active() { return active; },
    get maxActive() { return maxActive; }
  };
}

async function createHarness(options = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'streamvault-live-v2-'));
  const app = express();
  app.get('/live-relay/:channelId/playlist.m3u8', (req, res) => {
    res.setHeader('X-Test-Relay', 'v1');
    res.status(200).send('#EXTM3U\n# v1 remains available\n');
  });
  app.get('/api/playback/movie', (req, res) => res.json({ ok: true, type: 'movie' }));
  app.get('/api/playback/series', (req, res) => res.json({ ok: true, type: 'series' }));

  const channels = options.channels || [
    {
      id: 'sports',
      name: 'Authorized Sports',
      url: 'http://upstream.test/primary.m3u8',
      fallbackUrls: ['http://upstream.test/fallback.m3u8']
    }
  ];
  const ffmpeg = options.ffmpeg || fakeFfmpeg(options.fakeOptions);
  const manager = createLiveRelayV2({
    app,
    getChannels: () => channels,
    spawnProcess: ffmpeg.spawnProcess,
    cacheRoot: tempRoot,
    enabled: options.enabled ?? true,
    fallbackToV1: options.fallbackToV1 ?? true,
    startupMs: options.startupMs ?? 500,
    restartDelayMs: options.restartDelayMs ?? 20,
    cleanupMs: options.cleanupMs ?? 5000,
    segmentWaitMs: options.segmentWaitMs ?? 100,
    maxSegments: options.maxSegments,
    maxWorkers: options.maxWorkers,
    prewarmIds: options.prewarmIds || '',
    prewarmDelayMs: 5
  });
  manager.registerRoutes();

  const server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  return {
    manager,
    ffmpeg,
    tempRoot,
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      manager.close();
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  };
}

function mediaLines(playlist) {
  return playlist.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
}

test('normalizes relay playlists and accepts only configured HTTP sources', () => {
  const normalized = normalizePlaylist('#EXTM3U\n#EXTINF:2,\nfolder/seg_0001.ts\n');
  assert.equal(normalized.text, '#EXTM3U\n#EXTINF:2,\nseg_0001.ts\n');
  assert.deepEqual(normalized.segmentNames, ['seg_0001.ts']);
  assert.deepEqual(
    uniqueHttpSources({
      url: 'http://one.test/live.m3u8',
      fallbackUrls: ['file:///private.ts', 'http://one.test/live.m3u8', 'https://two.test/live.m3u8']
    }),
    ['http://one.test/live.m3u8', 'https://two.test/live.m3u8']
  );
  assert.throws(() => normalizePlaylist('#EXTM3U\n../secret.ts\n'), /Unexpected segment/);
});

test('feature flag defaults to off and leaves v1 available', async t => {
  const ffmpeg = fakeFfmpeg();
  const harness = await createHarness({ enabled: false, ffmpeg });
  t.after(() => harness.close());

  const status = await fetch(`${harness.baseUrl}/api/live-relay-v2/status`).then(response => response.json());
  assert.equal(status.enabled, false);
  assert.equal(status.activeWorkers, 0);
  assert.equal(ffmpeg.calls.length, 0);

  const v2 = await fetch(`${harness.baseUrl}/live-relay-v2/sports/playlist.m3u8`);
  assert.equal(v2.status, 404);
  const v1 = await fetch(`${harness.baseUrl}/live-relay/sports/playlist.m3u8`);
  assert.equal(v1.status, 200);
  assert.equal(v1.headers.get('x-test-relay'), 'v1');
});

test('shares one stream-copy worker across viewers and playback route changes', async t => {
  const harness = await createHarness();
  t.after(() => harness.close());
  const playlistUrl = `${harness.baseUrl}/live-relay-v2/sports/playlist.m3u8`;

  const responses = await Promise.all(Array.from({ length: 12 }, () => fetch(playlistUrl)));
  assert.deepEqual([...new Set(responses.map(response => response.status))], [200]);
  const playlists = await Promise.all(responses.map(response => response.text()));
  assert.equal(harness.ffmpeg.calls.length, 1);
  assert.equal(harness.ffmpeg.maxActive, 1);
  assert.ok(playlists.every(playlist => mediaLines(playlist).length === 1));

  const args = harness.ffmpeg.calls[0].args;
  assert.deepEqual(args.slice(args.indexOf('-c'), args.indexOf('-c') + 2), ['-c', 'copy']);
  assert.ok(args.includes('-http_persistent'));
  assert.ok(args.includes('-http_multiple'));
  assert.ok(args.includes('-hls_start_number_source'));
  assert.ok(!args.some(value => /(?:libx264|libx265|aac)/i.test(value)));

  const segment = mediaLines(playlists[0])[0];
  const segmentResponses = await Promise.all(
    Array.from({ length: 16 }, () => fetch(`${harness.baseUrl}/live-relay-v2/sports/${segment}`))
  );
  assert.deepEqual([...new Set(segmentResponses.map(response => response.status))], [200]);
  await Promise.all(segmentResponses.map(response => response.arrayBuffer()));

  const routeSequence = [
    '/live-relay-v2/sports/playlist.m3u8',
    '/api/playback/movie',
    '/api/playback/series',
    '/live-relay/sports/playlist.m3u8',
    '/live-relay-v2/sports/playlist.m3u8'
  ];
  const routeStatuses = [];
  for (const route of routeSequence) {
    routeStatuses.push((await fetch(harness.baseUrl + route)).status);
  }
  assert.deepEqual(routeStatuses, [200, 200, 200, 200, 200]);
  assert.equal(harness.ffmpeg.calls.length, 1);

  const statusText = await fetch(`${harness.baseUrl}/api/live-relay-v2/status/sports`).then(response => response.text());
  const status = JSON.parse(statusText);
  assert.equal(status.activeWorkers, 1);
  assert.equal(status.channels[0].peakClients, 16);
  assert.ok(status.channels[0].bytesServed > 0);
  assert.ok(!statusText.includes('upstream.test'));
});

test('serves the rolling buffer while a failed upstream worker is replaced', async t => {
  const harness = await createHarness({ restartDelayMs: 20 });
  t.after(() => harness.close());
  const playlistUrl = `${harness.baseUrl}/live-relay-v2/sports/playlist.m3u8`;

  const initial = await fetch(playlistUrl);
  assert.equal(initial.status, 200);
  const firstPlaylist = await initial.text();
  harness.ffmpeg.children[0].crash(7);

  const duringRecovery = await fetch(playlistUrl);
  assert.equal(duringRecovery.status, 200);
  assert.equal(await duringRecovery.text(), firstPlaylist);

  await sleep(80);
  const recovered = await fetch(playlistUrl);
  assert.equal(recovered.status, 200);
  assert.equal(harness.ffmpeg.calls.length, 2);
  assert.equal(harness.ffmpeg.maxActive, 1);
  const status = harness.manager.status('sports').channels[0];
  assert.equal(status.workerRunning, true);
  assert.equal(status.restartCount, 1);
});

test('falls back to v1 when v2 cannot become ready', async t => {
  const harness = await createHarness({
    ffmpeg: fakeFfmpeg({ silent: true }),
    startupMs: 250,
    fallbackToV1: true
  });
  t.after(() => harness.close());

  const response = await fetch(`${harness.baseUrl}/live-relay-v2/sports/playlist.m3u8`, {
    redirect: 'manual'
  });
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('x-sv-live-relay-fallback'), 'v1');
  assert.equal(response.headers.get('location'), '/live-relay/sports/playlist.m3u8');
  const fallback = await fetch(harness.baseUrl + response.headers.get('location'));
  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers.get('x-test-relay'), 'v1');
});

test('bounds workers and rolling segment cache per channel', async t => {
  const channels = [
    { id: 'sports', url: 'http://upstream.test/one.m3u8' },
    { id: 'news', url: 'http://upstream.test/two.m3u8' }
  ];
  const harness = await createHarness({ channels, maxWorkers: 1, maxSegments: 8, startupMs: 250 });
  t.after(() => harness.close());

  assert.equal((await fetch(`${harness.baseUrl}/live-relay-v2/sports/playlist.m3u8`)).status, 200);
  const second = await fetch(`${harness.baseUrl}/live-relay-v2/news/playlist.m3u8`, { redirect: 'manual' });
  assert.equal(second.status, 307);
  assert.equal(harness.ffmpeg.calls.length, 1);

  const dir = path.join(harness.tempRoot, 'sports');
  for (let index = 0; index < 20; index += 1) {
    fs.writeFileSync(path.join(dir, `seg_${String(5000 + index).padStart(19, '0')}.ts`), Buffer.alloc(188));
  }
  harness.manager.runMaintenance();
  const cached = fs.readdirSync(dir).filter(name => /^seg_\d+\.ts$/.test(name));
  assert.ok(cached.length <= 8, `expected at most 8 cached segments, got ${cached.length}`);
  assert.equal(harness.manager.status().activeWorkers, 1);
});
