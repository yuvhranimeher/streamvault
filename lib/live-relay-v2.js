'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function envFlag(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function safeChannelId(value) {
  const id = String(value || '');
  return /^[a-z0-9_-]+$/i.test(id) ? id : '';
}

function uniqueHttpSources(channel) {
  return [channel?.url, ...(Array.isArray(channel?.fallbackUrls) ? channel.fallbackUrls : [])]
    .map(value => String(value || '').trim())
    .filter((value, index, list) => /^https?:\/\//i.test(value) && list.indexOf(value) === index);
}

function normalizePlaylist(text) {
  const lines = String(text || '').split(/\r?\n/);
  const segmentNames = [];
  const normalized = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const name = path.basename(trimmed);
    if (!/^seg_\d+\.ts$/i.test(name)) throw new Error('Unexpected segment name in relay playlist');
    segmentNames.push(name);
    return name;
  });
  return { text: normalized.join('\n'), segmentNames };
}

function createLiveRelayV2(options = {}) {
  if (!options.app) throw new Error('Live relay v2 requires an Express app');
  if (typeof options.getChannels !== 'function') throw new Error('Live relay v2 requires getChannels');

  const app = options.app;
  const getChannels = options.getChannels;
  const tracker = options.tracker || null;
  const statusMiddleware = options.statusMiddleware || ((req, res, next) => next());
  const spawnProcess = options.spawnProcess || spawn;
  const now = options.now || Date.now;
  const enabled = options.enabled ?? envFlag('SV_LIVE_RELAY_V2_ENABLED', false);
  const fallbackToV1 = options.fallbackToV1 ?? envFlag('SV_LIVE_RELAY_V2_FALLBACK_TO_V1', true);
  const debug = options.debug ?? envFlag('SV_LIVE_RELAY_V2_DEBUG', false);
  const ffmpegBin = options.ffmpegBin || process.env.FFMPEG_BIN || process.env.FFMPEG_PATH || 'ffmpeg';
  const cacheRoot = options.cacheRoot || path.join(process.cwd(), 'cache', 'live-relay-v2');
  const config = {
    segmentSeconds: boundedNumber(options.segmentSeconds ?? process.env.SV_LIVE_RELAY_V2_SEGMENT_SECONDS, 2, 1, 10),
    playlistSegments: Math.round(boundedNumber(options.playlistSegments ?? process.env.SV_LIVE_RELAY_V2_PLAYLIST_SEGMENTS, 18, 4, 60)),
    deleteThreshold: Math.round(boundedNumber(options.deleteThreshold ?? process.env.SV_LIVE_RELAY_V2_DELETE_THRESHOLD, 12, 2, 60)),
    startupMs: boundedNumber(options.startupMs ?? process.env.SV_LIVE_RELAY_V2_STARTUP_MS, 25000, 250, 120000),
    staleMs: boundedNumber(options.staleMs ?? process.env.SV_LIVE_RELAY_V2_STALE_MS, 20000, 2000, 120000),
    staleServeMs: boundedNumber(options.staleServeMs ?? process.env.SV_LIVE_RELAY_V2_STALE_SERVE_MS, 90000, 5000, 300000),
    restartDelayMs: boundedNumber(options.restartDelayMs ?? process.env.SV_LIVE_RELAY_V2_RESTART_DELAY_MS, 1200, 10, 30000),
    idleMs: boundedNumber(options.idleMs ?? process.env.SV_LIVE_RELAY_V2_IDLE_MS, 10 * 60 * 1000, 30000, 24 * 60 * 60 * 1000),
    segmentWaitMs: boundedNumber(options.segmentWaitMs ?? process.env.SV_LIVE_RELAY_V2_SEGMENT_WAIT_MS, 2500, 0, 15000),
    cleanupMs: boundedNumber(options.cleanupMs ?? process.env.SV_LIVE_RELAY_V2_CLEANUP_MS, 5000, 100, 60000),
    maxSegments: Math.round(boundedNumber(options.maxSegments ?? process.env.SV_LIVE_RELAY_V2_MAX_SEGMENTS, 40, 8, 200)),
    maxBytes: boundedNumber(options.maxBytes ?? process.env.SV_LIVE_RELAY_V2_MAX_BYTES, 256 * 1024 * 1024, 16 * 1024 * 1024, 2 * 1024 * 1024 * 1024),
    maxTotalBytes: boundedNumber(options.maxTotalBytes ?? process.env.SV_LIVE_RELAY_V2_MAX_TOTAL_BYTES, 1024 * 1024 * 1024, 64 * 1024 * 1024, 8 * 1024 * 1024 * 1024),
    maxWorkers: Math.round(boundedNumber(options.maxWorkers ?? process.env.SV_LIVE_RELAY_V2_MAX_WORKERS, 12, 1, 100)),
    maxChannelClients: Math.round(boundedNumber(options.maxChannelClients ?? process.env.SV_LIVE_RELAY_V2_MAX_CHANNEL_CLIENTS, 150, 1, 5000)),
    maxTotalClients: Math.round(boundedNumber(options.maxTotalClients ?? process.env.SV_LIVE_RELAY_V2_MAX_TOTAL_CLIENTS, 500, 1, 20000)),
    slowClientMs: boundedNumber(options.slowClientMs ?? process.env.SV_LIVE_RELAY_V2_SLOW_CLIENT_MS, 30000, 1000, 300000)
  };
  const prewarmIds = String(options.prewarmIds ?? process.env.SV_LIVE_RELAY_V2_PREWARM_CHANNELS ?? '')
    .split(',')
    .map(value => safeChannelId(value.trim()))
    .filter(Boolean);

  const sessions = new Map();
  let totalActiveClients = 0;
  let maintenanceTimer = null;
  let prewarmTimer = null;
  let registered = false;
  let closed = false;
  const exitHandler = () => close();

  function log(channelId, message, data = {}) {
    if (!debug) return;
    console.log(`[Live Relay v2:${channelId}] ${message}`, data);
  }

  function getChannel(channelId) {
    const id = safeChannelId(channelId);
    if (!id) return null;
    return (getChannels() || []).find(channel => channel?.id === id) || null;
  }

  function readPlaylist(session) {
    try {
      const stat = fs.statSync(session.playlistPath);
      const normalized = normalizePlaylist(fs.readFileSync(session.playlistPath, 'utf8'));
      if (!normalized.text.includes('#EXTM3U') || !normalized.segmentNames.length) return null;
      if (normalized.segmentNames.some(name => !fs.existsSync(path.join(session.dir, name)))) return null;
      const state = { text: normalized.text, segmentNames: normalized.segmentNames, mtimeMs: stat.mtimeMs };
      session.lastGoodPlaylist = state;
      session.lastPlaylistAt = stat.mtimeMs;
      session.lastSegmentAt = Math.max(
        session.lastSegmentAt || 0,
        ...normalized.segmentNames.map(name => {
          try { return fs.statSync(path.join(session.dir, name)).mtimeMs; } catch { return 0; }
        })
      );
      if (session.process && now() - stat.mtimeMs <= config.staleMs) session.state = 'running';
      if (session.process && stat.mtimeMs >= session.startedAt - 100) session.failureStreak = 0;
      return state;
    } catch {
      return null;
    }
  }

  function usablePlaylist(session) {
    const current = readPlaylist(session);
    if (current && now() - current.mtimeMs <= config.staleServeMs) return current;
    const previous = session.lastGoodPlaylist;
    if (previous && now() - previous.mtimeMs <= config.staleServeMs &&
        previous.segmentNames.every(name => fs.existsSync(path.join(session.dir, name)))) {
      return previous;
    }
    return null;
  }

  function createSession(channelId, pinned = false) {
    const dir = path.join(cacheRoot, channelId);
    fs.mkdirSync(dir, { recursive: true });
    return {
      channelId,
      dir,
      playlistPath: path.join(dir, 'index.m3u8'),
      process: null,
      processToken: null,
      stopping: false,
      restartReason: '',
      restartTimer: null,
      candidateIndex: 0,
      startedAt: 0,
      lastAccess: now(),
      lastPlaylistAt: 0,
      lastSegmentAt: 0,
      lastGoodPlaylist: null,
      lastError: '',
      stderrTail: '',
      lastExitCode: null,
      failureStreak: 0,
      restartCount: 0,
      launchCount: 0,
      activeClients: 0,
      peakClients: 0,
      bytesServed: 0,
      segmentsServed: 0,
      playlistRequests: 0,
      rejectedClients: 0,
      pinned,
      state: 'idle'
    };
  }

  function scheduleRestart(session, reason) {
    if (closed || !enabled || session.restartTimer) return;
    session.state = 'recovering';
    session.lastError = reason;
    const backoffMs = Math.min(
      5000,
      config.restartDelayMs * (2 ** Math.min(4, Math.max(0, session.failureStreak - 1)))
    );
    session.restartTimer = setTimeout(() => {
      session.restartTimer = null;
      if (sessions.get(session.channelId) !== session || session.process) return;
      launch(session, reason);
    }, backoffMs);
    session.restartTimer.unref?.();
  }

  function launch(session, reason = 'start') {
    if (closed || !enabled || session.process) return session;
    const activeWorkers = [...sessions.values()].filter(candidate => candidate.process).length;
    if (activeWorkers >= config.maxWorkers) {
      session.state = 'at-capacity';
      session.lastError = 'worker capacity reached';
      return session;
    }
    const sources = uniqueHttpSources(getChannel(session.channelId));
    if (!sources.length) {
      session.state = 'unavailable';
      session.lastError = 'channel has no authorized HTTP source';
      return session;
    }

    const selectedIndex = ((session.candidateIndex % sources.length) + sources.length) % sources.length;
    session.candidateIndex = selectedIndex;
    session.startedAt = now();
    session.state = 'starting';
    session.lastError = '';
    session.stopping = false;
    session.restartReason = '';
    const args = [
      '-hide_banner', '-loglevel', 'warning', '-nostdin',
      '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
      '-rw_timeout', '15000000', '-http_persistent', '1', '-http_multiple', '1',
      '-fflags', '+genpts+discardcorrupt',
      '-i', sources[selectedIndex],
      '-map', '0:v:0?', '-map', '0:a:0?', '-c', 'copy', '-max_muxing_queue_size', '2048',
      '-f', 'hls', '-hls_time', String(config.segmentSeconds),
      '-hls_list_size', String(config.playlistSegments),
      '-hls_delete_threshold', String(config.deleteThreshold),
      '-hls_start_number_source', 'epoch',
      '-hls_flags', 'append_list+delete_segments+omit_endlist+independent_segments+temp_file',
      '-hls_segment_filename', path.join(session.dir, 'seg_%019d.ts'),
      session.playlistPath
    ];

    let child;
    try {
      child = spawnProcess(ffmpegBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (error) {
      session.lastError = `FFmpeg spawn failed: ${error.message}`;
      session.failureStreak += 1;
      scheduleRestart(session, session.lastError);
      return session;
    }

    const token = {};
    session.process = child;
    session.processToken = token;
    session.launchCount += 1;
    if (session.launchCount > 1) session.restartCount += 1;
    log(session.channelId, 'worker launched', {
      reason,
      candidate: selectedIndex + 1,
      candidates: sources.length,
      pid: child.pid
    });

    let stderrTail = '';
    child.stderr?.on('data', chunk => {
      stderrTail = (stderrTail + chunk.toString()).slice(-2000);
      session.stderrTail = stderrTail;
    });
    child.on('error', error => {
      if (session.processToken !== token) return;
      session.lastError = `FFmpeg error: ${error.message}`;
    });
    child.on('close', code => {
      if (session.processToken !== token) return;
      session.process = null;
      session.processToken = null;
      session.stopping = false;
      session.lastExitCode = code;
      session.failureStreak += 1;
      session.candidateIndex = (selectedIndex + 1) % sources.length;
      const summary = stderrTail.trim().split(/\r?\n/).pop() || `FFmpeg exited with code ${code}`;
      log(session.channelId, 'worker exited', { code, candidate: selectedIndex + 1, summary });
      scheduleRestart(session, session.restartReason || `worker exited with code ${code}`);
    });
    return session;
  }

  function ensure(channelId, { pinned = false } = {}) {
    const channel = getChannel(channelId);
    if (!channel) return null;
    let session = sessions.get(channel.id);
    if (!session) {
      session = createSession(channel.id, pinned);
      sessions.set(channel.id, session);
    }
    session.lastAccess = now();
    session.pinned = session.pinned || pinned;
    if (!session.process && !session.restartTimer) launch(session);
    return session;
  }

  function stop(session, reason = 'stopped') {
    if (!session) return;
    if (session.restartTimer) clearTimeout(session.restartTimer);
    session.restartTimer = null;
    session.state = 'stopped';
    session.lastError = reason;
    const child = session.process;
    session.process = null;
    session.processToken = null;
    try { child?.kill('SIGKILL'); } catch {}
  }

  async function waitForPlaylist(session) {
    const deadline = now() + config.startupMs;
    while (now() <= deadline) {
      const state = usablePlaylist(session);
      if (state) return state;
      if (!session.process && !session.restartTimer) launch(session, 'playlist wait');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return usablePlaylist(session);
  }

  async function waitForSegment(session, filename) {
    const deadline = now() + config.segmentWaitMs;
    const filePath = path.join(session.dir, filename);
    while (now() <= deadline) {
      if (fs.existsSync(filePath)) return filePath;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return '';
  }

  function fallback(res, channelId) {
    if (!fallbackToV1) {
      res.setHeader('Retry-After', '1');
      return res.status(503).send('Live relay v2 is starting');
    }
    res.setHeader('X-SV-Live-Relay-Fallback', 'v1');
    return res.redirect(307, `/live-relay/${encodeURIComponent(channelId)}/playlist.m3u8`);
  }

  async function playlistHandler(req, res) {
    const channel = getChannel(req.params.channelId);
    if (!channel) return res.status(404).send('Channel not found');
    if (!enabled) return res.status(404).send('Live relay v2 is disabled');

    const session = ensure(channel.id);
    session.playlistRequests += 1;
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    tracker?.trackStreamStart?.(ip, channel.id, channel.name || channel.id, 'live-relay-v2', req.headers['user-agent'] || '');

    const state = await waitForPlaylist(session);
    if (!state) return fallback(res, channel.id);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-SV-Live-Relay-Version', '2');
    res.setHeader('X-SV-Live-Relay-Segments', String(state.segmentNames.length));
    res.setHeader('X-SV-Live-Relay-State', session.state);
    return res.send(state.text);
  }

  async function segmentHandler(req, res) {
    const channel = getChannel(req.params.channelId);
    if (!channel) return res.status(404).send('Channel not found');
    if (!enabled) return res.status(404).send('Live relay v2 is disabled');
    const filename = path.basename(String(req.params.segment || ''));
    if (!/^seg_\d+\.ts$/i.test(filename)) return res.status(400).send('Invalid relay segment');
    const session = ensure(channel.id);
    if (totalActiveClients >= config.maxTotalClients || session.activeClients >= config.maxChannelClients) {
      session.rejectedClients += 1;
      res.setHeader('Retry-After', '1');
      return res.status(503).send('Live relay v2 is at capacity');
    }
    const filePath = await waitForSegment(session, filename);
    if (!filePath) return res.status(404).send('Segment not ready');

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      totalActiveClients = Math.max(0, totalActiveClients - 1);
      session.activeClients = Math.max(0, session.activeClients - 1);
    };
    totalActiveClients += 1;
    session.activeClients += 1;
    session.peakClients = Math.max(session.peakClients, session.activeClients);
    session.lastAccess = now();
    try { session.bytesServed += fs.statSync(filePath).size; } catch {}
    session.segmentsServed += 1;
    res.on('close', release);
    res.on('finish', release);
    res.setTimeout(config.slowClientMs, () => res.destroy());
    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Cache-Control', 'public, max-age=12, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-SV-Live-Relay-Version', '2');
    return res.sendFile(filePath, error => {
      if (error && !res.headersSent) res.status(error.statusCode || 500).end();
      release();
    });
  }

  function cacheMetrics(session) {
    try {
      const entries = fs.readdirSync(session.dir, { withFileTypes: true })
        .filter(entry => entry.isFile() && /^seg_\d+\.ts$/i.test(entry.name))
        .map(entry => fs.statSync(path.join(session.dir, entry.name)));
      return {
        segmentFiles: entries.length,
        bytes: entries.reduce((sum, entry) => sum + entry.size, 0)
      };
    } catch {
      return { segmentFiles: 0, bytes: 0 };
    }
  }

  function publicStatus(session) {
    const cache = cacheMetrics(session);
    return {
      channelId: session.channelId,
      state: session.state,
      workerPid: session.process?.pid || null,
      workerRunning: Boolean(session.process),
      candidateNumber: session.candidateIndex + 1,
      launchCount: session.launchCount,
      restartCount: session.restartCount,
      lastExitCode: session.lastExitCode,
      consecutiveFailures: session.failureStreak,
      lastError: session.lastError,
      startedAt: session.startedAt || null,
      lastPlaylistAt: session.lastPlaylistAt || null,
      lastSegmentAt: session.lastSegmentAt || null,
      playlistAgeMs: session.lastPlaylistAt ? Math.max(0, now() - session.lastPlaylistAt) : null,
      activeClients: session.activeClients,
      peakClients: session.peakClients,
      rejectedClients: session.rejectedClients,
      playlistRequests: session.playlistRequests,
      segmentsServed: session.segmentsServed,
      bytesServed: session.bytesServed,
      cacheSegments: cache.segmentFiles,
      cacheBytes: cache.bytes,
      pinned: session.pinned
    };
  }

  function statusPayload(channelId = '') {
    const selected = channelId ? [sessions.get(channelId)].filter(Boolean) : [...sessions.values()];
    const memory = process.memoryUsage();
    return {
      enabled,
      fallbackToV1,
      activeWorkers: selected.filter(session => session.process).length,
      activeClients: channelId ? selected.reduce((sum, session) => sum + session.activeClients, 0) : totalActiveClients,
      process: {
        pid: process.pid,
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        loadAverage: os.loadavg()
      },
      limits: {
        playlistSegments: config.playlistSegments,
        segmentSeconds: config.segmentSeconds,
        maxSegments: config.maxSegments,
        maxBytes: config.maxBytes,
        maxTotalBytes: config.maxTotalBytes,
        maxWorkers: config.maxWorkers,
        maxChannelClients: config.maxChannelClients,
        maxTotalClients: config.maxTotalClients
      },
      channels: selected.map(publicStatus)
    };
  }

  function cleanupSession(session) {
    let referenced = new Set();
    try {
      referenced = new Set(normalizePlaylist(fs.readFileSync(session.playlistPath, 'utf8')).segmentNames);
    } catch {}
    let files;
    try {
      files = fs.readdirSync(session.dir, { withFileTypes: true })
        .filter(entry => entry.isFile() && /^seg_\d+\.ts$/i.test(entry.name))
        .map(entry => {
          const stat = fs.statSync(path.join(session.dir, entry.name));
          return { name: entry.name, size: stat.size, mtimeMs: stat.mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
    } catch {
      return;
    }
    const requiredFiles = files.filter(file => referenced.has(file.name));
    let kept = requiredFiles.length;
    let keptBytes = requiredFiles.reduce((sum, file) => sum + file.size, 0);
    for (const file of files.filter(file => !referenced.has(file.name))) {
      if (kept < config.maxSegments && keptBytes + file.size <= config.maxBytes) {
        kept += 1;
        keptBytes += file.size;
        continue;
      }
      try { fs.unlinkSync(path.join(session.dir, file.name)); } catch {}
    }
  }

  function runMaintenance() {
    if (closed || !enabled) return;
    const timestamp = now();
    for (const [channelId, session] of sessions) {
      cleanupSession(session);
      const playlist = readPlaylist(session);
      const stale = playlist && timestamp - playlist.mtimeMs > config.staleMs &&
        timestamp - session.startedAt > config.startupMs;
      const startupStuck = !playlist && session.process && timestamp - session.startedAt > config.startupMs;
      const dead = session.process && (session.process.exitCode !== null || session.process.killed);
      if ((stale || startupStuck || dead) && !session.stopping) {
        const reason = stale ? 'playlist stalled' : (startupStuck ? 'startup stalled' : 'worker stopped');
        session.lastError = reason;
        log(channelId, 'worker unhealthy', {
          reason,
          summary: session.stderrTail.trim().split(/\r?\n/).pop() || 'no FFmpeg diagnostic'
        });
        const child = session.process;
        session.stopping = true;
        session.restartReason = reason;
        try { child?.kill('SIGKILL'); }
        catch {
          session.stopping = false;
          session.restartReason = '';
        }
      } else if (!session.process && !session.restartTimer &&
                 (session.pinned || timestamp - session.lastAccess <= config.idleMs)) {
        launch(session, 'maintenance recovery');
      }
      if (!session.pinned && timestamp - session.lastAccess > config.idleMs) {
        stop(session, 'idle timeout');
        sessions.delete(channelId);
        try { fs.rmSync(session.dir, { recursive: true, force: true }); } catch {}
      }
    }
    cleanupGlobalCache();
  }

  function cleanupGlobalCache() {
    let files = [];
    try {
      for (const entry of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const session = sessions.get(entry.name);
        const protectedNames = new Set(session?.lastGoodPlaylist?.segmentNames || []);
        const dir = path.join(cacheRoot, entry.name);
        for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!file.isFile() || !/^seg_\d+\.ts$/i.test(file.name)) continue;
          const stat = fs.statSync(path.join(dir, file.name));
          files.push({
            path: path.join(dir, file.name),
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            protected: protectedNames.has(file.name)
          });
        }
      }
    } catch {
      return;
    }
    const protectedFiles = files.filter(file => file.protected);
    let keptBytes = protectedFiles.reduce((sum, file) => sum + file.size, 0);
    files = files.filter(file => !file.protected).sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const file of files) {
      if (keptBytes + file.size <= config.maxTotalBytes) {
        keptBytes += file.size;
        continue;
      }
      try { fs.unlinkSync(file.path); } catch {}
    }
  }

  function registerRoutes() {
    if (registered) return;
    registered = true;
    app.get(['/live-relay-v2/:channelId/playlist.m3u8', '/live-relay-v2/:channelId/index.m3u8'], playlistHandler);
    app.get('/live-relay-v2/:channelId/:segment', segmentHandler);
    app.get('/api/live-relay-v2/status', statusMiddleware, (req, res) => res.json(statusPayload()));
    app.get('/api/live-relay-v2/status/:channelId', statusMiddleware, (req, res) => {
      const channel = getChannel(req.params.channelId);
      if (!channel) return res.status(404).json({ ok: false, error: 'Channel not found' });
      return res.json(statusPayload(channel.id));
    });
    if (!enabled) return;
    fs.mkdirSync(cacheRoot, { recursive: true });
    process.once('exit', exitHandler);
    maintenanceTimer = setInterval(runMaintenance, config.cleanupMs);
    maintenanceTimer.unref?.();
    prewarmTimer = setTimeout(() => {
      for (const channelId of prewarmIds) ensure(channelId, { pinned: true });
    }, options.prewarmDelayMs ?? 2500);
    prewarmTimer.unref?.();
  }

  function close() {
    closed = true;
    if (maintenanceTimer) clearInterval(maintenanceTimer);
    if (prewarmTimer) clearTimeout(prewarmTimer);
    maintenanceTimer = null;
    prewarmTimer = null;
    process.removeListener('exit', exitHandler);
    for (const session of sessions.values()) stop(session, 'manager closed');
    sessions.clear();
  }

  return {
    enabled,
    config: { ...config },
    registerRoutes,
    ensure,
    runMaintenance,
    status: statusPayload,
    close,
    _sessions: sessions
  };
}

module.exports = {
  createLiveRelayV2,
  normalizePlaylist,
  uniqueHttpSources
};
