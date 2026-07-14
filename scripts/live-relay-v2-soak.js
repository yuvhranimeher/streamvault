'use strict';

const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createLiveRelayV2 } = require('../lib/live-relay-v2');

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] != null ? process.argv[index + 1] : fallback;
}

function numberArgument(name, fallback, min, max) {
  const value = Number(argument(name, fallback));
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

const durationSeconds = numberArgument('duration-seconds', 1800, 20, 7200);
const clientCount = Math.round(numberArgument('clients', 12, 1, 100));
const interruptionSeconds = numberArgument('interruption-seconds', 8, 0, 60);
const interruptionAtSeconds = numberArgument(
  'interruption-at-seconds',
  Math.max(10, Math.floor(durationSeconds / 2)),
  5,
  Math.max(5, durationSeconds - interruptionSeconds - 3)
);
const outputPath = argument('output', '');
const ffmpegBin = process.env.FFMPEG_BIN || process.env.FFMPEG_PATH || 'ffmpeg';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'streamvault-live-v2-soak-'));
const upstreamDir = path.join(tempRoot, 'upstream');
const relayDir = path.join(tempRoot, 'relay');
fs.mkdirSync(upstreamDir, { recursive: true });
let generator = null;
let upstreamServer = null;
let relayServer = null;
let manager = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function waitFor(predicate, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  return (async () => {
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await sleep(100);
    }
    throw new Error(message);
  })();
}

function processSample(pid) {
  if (!pid) return null;
  try {
    if (process.platform === 'win32') {
      const command = `Get-Process -Id ${Number(pid)} | Select-Object Id,CPU,WorkingSet64 | ConvertTo-Json -Compress`;
      const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
        encoding: 'utf8',
        timeout: 3000,
        windowsHide: true
      });
      const value = JSON.parse(raw);
      return {
        pid: value.Id,
        cpuSeconds: Number(value.CPU || 0),
        rssBytes: Number(value.WorkingSet64 || 0)
      };
    }
    const status = fs.readFileSync(`/proc/${Number(pid)}/status`, 'utf8');
    const rss = Number((status.match(/^VmRSS:\s+(\d+)/m) || [])[1] || 0) * 1024;
    return { pid: Number(pid), cpuSeconds: null, rssBytes: rss };
  } catch {
    return null;
  }
}

function serveFile(res, filePath, metrics) {
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    return res.end('not ready');
  }
  const body = fs.readFileSync(filePath);
  metrics.bytes += body.length;
  metrics.responses += 1;
  res.statusCode = 200;
  res.setHeader('Content-Type', filePath.endsWith('.m3u8')
    ? 'application/vnd.apple.mpegurl'
    : 'video/MP2T');
  res.setHeader('Content-Length', body.length);
  res.setHeader('Connection', 'keep-alive');
  res.end(body);
}

function latestSegment(playlist) {
  return String(playlist || '').split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .at(-1) || '';
}

async function closeServer(server) {
  if (!server?.listening) return;
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
}

async function shutdown() {
  manager?.close();
  try { generator?.kill('SIGKILL'); } catch {}
  await Promise.all([closeServer(relayServer), closeServer(upstreamServer)]);
  await sleep(100);
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
}

async function main() {
  const upstreamMetrics = { requests: 0, responses: 0, bytes: 0, unavailable: 0 };
  let upstreamAvailable = true;
  let generatorStderr = '';
  generator = spawn(ffmpegBin, [
    '-hide_banner', '-loglevel', 'warning', '-nostdin',
    '-re', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25',
    '-re', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000',
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'mpeg2video', '-b:v', '1400k', '-g', '50',
    '-c:a', 'aac', '-b:a', '96k',
    '-f', 'hls', '-hls_time', '2', '-hls_list_size', '12',
    '-hls_flags', 'delete_segments+omit_endlist+independent_segments+temp_file',
    '-hls_segment_filename', path.join(upstreamDir, 'source_%09d.ts'),
    path.join(upstreamDir, 'index.m3u8')
  ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  generator.stderr.on('data', chunk => {
    generatorStderr = (generatorStderr + chunk.toString()).slice(-4000);
  });

  upstreamServer = http.createServer((req, res) => {
    upstreamMetrics.requests += 1;
    if (!upstreamAvailable) {
      upstreamMetrics.unavailable += 1;
      res.statusCode = 503;
      return res.end('synthetic upstream interruption');
    }
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (!/^\/(?:index\.m3u8|source_\d+\.ts)$/.test(pathname)) {
      res.statusCode = 404;
      return res.end('not found');
    }
    return serveFile(res, path.join(upstreamDir, path.basename(pathname)), upstreamMetrics);
  });
  await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
  const upstreamPort = upstreamServer.address().port;

  await waitFor(
    () => fs.existsSync(path.join(upstreamDir, 'index.m3u8')),
    15000,
    `synthetic upstream did not start: ${generatorStderr}`
  );

  const app = express();
  app.get('/live-relay/:channelId/playlist.m3u8', (req, res) => {
    res.status(200).send('#EXTM3U\n# synthetic v1 fallback\n');
  });
  app.get('/api/playback/movie', (req, res) => res.json({ ok: true, type: 'movie' }));
  app.get('/api/playback/series', (req, res) => res.json({ ok: true, type: 'series' }));
  const channel = {
    id: 'synthetic',
    name: 'Generated authorized test stream',
    url: `http://127.0.0.1:${upstreamPort}/index.m3u8`
  };
  manager = createLiveRelayV2({
    app,
    getChannels: () => [channel],
    enabled: true,
    fallbackToV1: true,
    ffmpegBin,
    cacheRoot: relayDir,
    prewarmIds: 'synthetic',
    prewarmDelayMs: 0,
    startupMs: 15000,
    staleMs: 7000,
    staleServeMs: 60000,
    restartDelayMs: 500,
    cleanupMs: 1000,
    maxSegments: 40,
    maxWorkers: 2
  });
  manager.registerRoutes();

  relayServer = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const relayPort = relayServer.address().port;
  const baseUrl = `http://127.0.0.1:${relayPort}`;
  const playlistUrl = `${baseUrl}/live-relay-v2/synthetic/playlist.m3u8`;
  const startedAt = Date.now();
  let firstPlaylistAt = 0;
  let firstSegmentAt = 0;
  let recoveryAt = 0;
  let upstreamRestoredAt = 0;
  let sequenceBeforeInterruption = '';
  let sawNewSegmentAfterInterruption = false;
  let currentSegment = '';
  let maxWorkers = 0;
  let maxRelayRssBytes = 0;
  let maxNodeRssBytes = 0;
  let peakClientCount = 0;
  let restartCount = 0;
  const ffmpegCpuByPid = new Map();
  const clientMetrics = Array.from({ length: clientCount }, (_, index) => ({
    id: index + 1,
    joinedAtSeconds: index < Math.ceil(clientCount / 2)
      ? 0
      : Math.min(30, Math.max(5, Math.floor(durationSeconds * 0.1))),
    playlistOk: 0,
    playlistErrors: 0,
    segmentOk: 0,
    segmentErrors: 0,
    bytes: 0,
    maxLatencyMs: 0,
    lastSegment: ''
  }));

  const monitor = (async () => {
    while (Date.now() - startedAt < durationSeconds * 1000) {
      const status = manager.status();
      maxWorkers = Math.max(maxWorkers, status.activeWorkers);
      maxNodeRssBytes = Math.max(maxNodeRssBytes, status.process.rssBytes);
      const channelStatus = status.channels[0];
      if (channelStatus) {
        peakClientCount = Math.max(peakClientCount, channelStatus.peakClients);
        restartCount = Math.max(restartCount, channelStatus.restartCount);
        const sample = processSample(channelStatus.workerPid);
        if (sample) {
          maxRelayRssBytes = Math.max(maxRelayRssBytes, sample.rssBytes);
          const prior = ffmpegCpuByPid.get(sample.pid);
          if (!prior) ffmpegCpuByPid.set(sample.pid, { first: sample, last: sample });
          else prior.last = sample;
        }
      }
      await sleep(2000);
    }
  })();

  const clients = clientMetrics.map(metrics => (async () => {
    await sleep(metrics.joinedAtSeconds * 1000);
    let nextRefreshAt = Date.now() + 15000;
    while (Date.now() - startedAt < durationSeconds * 1000) {
      const requestStarted = Date.now();
      try {
        const playlistResponse = await fetch(playlistUrl, { signal: AbortSignal.timeout(8000) });
        if (!playlistResponse.ok) throw new Error(`playlist ${playlistResponse.status}`);
        const playlist = await playlistResponse.text();
        metrics.playlistOk += 1;
        if (!firstPlaylistAt) firstPlaylistAt = Date.now();
        const segment = latestSegment(playlist);
        if (Date.now() >= nextRefreshAt) {
          metrics.lastSegment = '';
          nextRefreshAt = Date.now() + 15000;
        }
        if (segment && segment !== metrics.lastSegment) {
          const response = await fetch(
            `${baseUrl}/live-relay-v2/synthetic/${encodeURIComponent(segment)}`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (!response.ok) throw new Error(`segment ${response.status}`);
          const body = await response.arrayBuffer();
          if (!body.byteLength) throw new Error('empty segment');
          metrics.segmentOk += 1;
          metrics.bytes += body.byteLength;
          metrics.lastSegment = segment;
          currentSegment = segment;
          if (!firstSegmentAt) firstSegmentAt = Date.now();
          if (sequenceBeforeInterruption && upstreamRestoredAt &&
              Date.now() >= upstreamRestoredAt && segment !== sequenceBeforeInterruption) {
            sawNewSegmentAfterInterruption = true;
            if (!recoveryAt) recoveryAt = Date.now();
          }
        }
      } catch (error) {
        if (String(error.message).startsWith('segment')) metrics.segmentErrors += 1;
        else metrics.playlistErrors += 1;
      }
      metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, Date.now() - requestStarted);
      await sleep(700);
    }
  })());

  const interruption = (async () => {
    if (!interruptionSeconds) return;
    await sleep(interruptionAtSeconds * 1000);
    sequenceBeforeInterruption = currentSegment;
    upstreamAvailable = false;
    await sleep(interruptionSeconds * 1000);
    upstreamAvailable = true;
    upstreamRestoredAt = Date.now();
  })();

  await Promise.all([monitor, interruption, ...clients]);
  const finishedAt = Date.now();

  const transitionStatuses = [];
  for (const route of [
    '/live-relay-v2/synthetic/playlist.m3u8',
    '/api/playback/movie',
    '/api/playback/series',
    '/live-relay/synthetic/playlist.m3u8',
    '/live-relay-v2/synthetic/playlist.m3u8'
  ]) {
    try {
      transitionStatuses.push((await fetch(baseUrl + route, { signal: AbortSignal.timeout(20000) })).status);
    } catch {
      transitionStatuses.push(0);
    }
  }

  const finalStatus = manager.status();
  const channelStatus = finalStatus.channels[0] || {};
  let ffmpegCpuSeconds = 0;
  for (const samples of ffmpegCpuByPid.values()) {
    if (samples.first.cpuSeconds != null && samples.last.cpuSeconds != null) {
      ffmpegCpuSeconds += Math.max(0, samples.last.cpuSeconds - samples.first.cpuSeconds);
    }
  }
  const totalPlaylistAttempts = clientMetrics.reduce(
    (sum, client) => sum + client.playlistOk + client.playlistErrors,
    0
  );
  const totalSegmentAttempts = clientMetrics.reduce(
    (sum, client) => sum + client.segmentOk + client.segmentErrors,
    0
  );
  const totalClientBytes = clientMetrics.reduce((sum, client) => sum + client.bytes, 0);
  const playlistSuccessRate = totalPlaylistAttempts
    ? clientMetrics.reduce((sum, client) => sum + client.playlistOk, 0) / totalPlaylistAttempts
    : 0;
  const segmentSuccessRate = totalSegmentAttempts
    ? clientMetrics.reduce((sum, client) => sum + client.segmentOk, 0) / totalSegmentAttempts
    : 0;
  const elapsedSeconds = (finishedAt - startedAt) / 1000;
  const result = {
    ok: true,
    config: {
      durationSeconds,
      clientCount,
      interruptionAtSeconds,
      interruptionSeconds
    },
    startup: {
      playlistMs: firstPlaylistAt ? firstPlaylistAt - startedAt : null,
      firstSegmentMs: firstSegmentAt ? firstSegmentAt - startedAt : null
    },
    recovery: {
      upstreamInterrupted: interruptionSeconds > 0,
      newSegmentAfterInterruption: sawNewSegmentAfterInterruption,
      recoveryMs: recoveryAt
        ? recoveryAt - upstreamRestoredAt
        : null,
      restartCount
    },
    clients: {
      continuousViewerSeconds: elapsedSeconds,
      joinedMidStream: clientMetrics.some(client => client.joinedAtSeconds > 0),
      playlistSuccessRate,
      segmentSuccessRate,
      totalClientBytes,
      peakSimultaneousSegmentResponses: peakClientCount,
      maximumRequestLatencyMs: Math.max(...clientMetrics.map(client => client.maxLatencyMs))
    },
    resources: {
      maxWorkers,
      finalWorkers: finalStatus.activeWorkers,
      maxNodeRssBytes,
      maxRelayFfmpegRssBytes: maxRelayRssBytes,
      ffmpegCpuSeconds,
      ffmpegAverageCpuPercent: elapsedSeconds ? (ffmpegCpuSeconds / elapsedSeconds) * 100 : null,
      cacheSegments: channelStatus.cacheSegments || 0,
      cacheBytes: channelStatus.cacheBytes || 0
    },
    network: {
      upstreamRequests: upstreamMetrics.requests,
      upstreamResponses: upstreamMetrics.responses,
      upstreamUnavailableResponses: upstreamMetrics.unavailable,
      upstreamBytesToRelay: upstreamMetrics.bytes,
      relayBytesToClients: channelStatus.bytesServed || 0,
      measuredClientBytes: totalClientBytes,
      fanOutRatio: upstreamMetrics.bytes ? totalClientBytes / upstreamMetrics.bytes : null
    },
    routeSequence: {
      statuses: transitionStatuses,
      passed: transitionStatuses.every(status => status === 200)
    }
  };
  result.ok = Boolean(
    firstSegmentAt &&
    playlistSuccessRate >= 0.95 &&
    segmentSuccessRate >= 0.95 &&
    maxWorkers === 1 &&
    channelStatus.cacheSegments <= manager.config.maxSegments &&
    result.routeSequence.passed &&
    (!interruptionSeconds || sawNewSegmentAfterInterruption)
  );

  const output = JSON.stringify(result, null, 2);
  process.stdout.write(output + '\n');
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), output + '\n');
  return result.ok ? 0 : 1;
}

let exitCode = 1;
main()
  .then(code => { exitCode = code; })
  .catch(error => {
    console.error(error.stack || error.message);
    exitCode = 1;
  })
  .finally(async () => {
    await shutdown();
    process.exitCode = exitCode;
  });
