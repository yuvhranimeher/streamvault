/**
 * StreamVault — Request & Stream Tracker Middleware
 * Add to server.js: const tracker = require('./middleware/tracker');
 *                   app.use(tracker.requestMiddleware);
 */

const fs   = require('fs');
const path = require('path');

// ── Log file paths ────────────────────────────────────────────────────────────
const LOGS_DIR      = path.join(__dirname, '..', 'logs');
const SESSIONS_FILE = path.join(LOGS_DIR, 'sessions.json');
const STREAMS_FILE  = path.join(LOGS_DIR, 'streams.json');
const EVENTS_FILE   = path.join(LOGS_DIR, 'watch-events.json');
const ERRORS_FILE   = path.join(LOGS_DIR, 'errors.json');
const PERF_FILE     = path.join(LOGS_DIR, 'perf.json');

// ── Ensure logs directory exists ──────────────────────────────────────────────
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

// ── In-memory state (flushed to disk periodically) ────────────────────────────
let sessions     = {};   // { ip: { ip, lastSeen, userAgent, country, requests, currentStream } }
let activeStreams = {};   // { streamKey: { ip, streamId, name, type, startTime, ua } }
let perfSamples  = [];   // last 200 { ts, route, ms }
let errorLog     = [];   // last 500 { ts, route, status, msg }
let contentStats = {};   // { movieName: { count, lastWatched } }

// ── Load persisted data on startup ───────────────────────────────────────────
function loadJSON(file, fallback) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  return fallback;
}
sessions     = loadJSON(SESSIONS_FILE, {});
activeStreams = loadJSON(STREAMS_FILE,  {});
contentStats = (() => {
  const events = loadJSON(EVENTS_FILE, []);
  const stats  = {};
  for (const e of events) {
    if (!stats[e.name]) stats[e.name] = { count: 0, lastWatched: e.ts, type: e.type };
    stats[e.name].count++;
    if (e.ts > stats[e.name].lastWatched) stats[e.name].lastWatched = e.ts;
  }
  return stats;
})();
perfSamples = loadJSON(PERF_FILE,   []);
errorLog    = loadJSON(ERRORS_FILE, []);

// ── Purge stale sessions (no activity in 5 min) ───────────────────────────────
function purgeStaleSessions() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const ip of Object.keys(sessions)) {
    if (sessions[ip].lastSeen < cutoff) delete sessions[ip];
  }
}

// ── IP anonymiser (mask last octet for privacy) ───────────────────────────────
function maskIp(ip) {
  if (!ip) return 'unknown';
  const v4 = ip.replace(/^::ffff:/, '');
  const parts = v4.split('.');
  if (parts.length === 4) return parts.slice(0, 3).join('.') + '.xxx';
  return ip.slice(0, -4) + 'xxxx'; // IPv6 partial mask
}

// ── Persist to disk (every 10 s) ──────────────────────────────────────────────
function persist() {
  purgeStaleSessions();
  const write = (file, data) => {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
  };
  write(SESSIONS_FILE, sessions);
  write(STREAMS_FILE,  activeStreams);
  write(PERF_FILE,     perfSamples.slice(-200));
  write(ERRORS_FILE,   errorLog.slice(-500));
}
setInterval(persist, 10_000);

// ── Main request middleware ───────────────────────────────────────────────────
function requestMiddleware(req, res, next) {
  const start = Date.now();
  const ip    = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ua    = req.headers['user-agent'] || '';
  const route = req.path;

  // Update session
  if (!sessions[ip]) sessions[ip] = { ip, maskedIp: maskIp(ip), firstSeen: Date.now(), lastSeen: Date.now(), ua, requests: 0, currentStream: null, device: detectDevice(ua) };
  sessions[ip].lastSeen = Date.now();
  sessions[ip].requests++;

  res.on('finish', () => {
    const ms = Date.now() - start;

    // Perf sample (skip static assets)
    if (!route.match(/\.(css|js|png|jpg|ico|woff|woff2)$/)) {
      perfSamples.push({ ts: Date.now(), route, ms, status: res.statusCode });
      if (perfSamples.length > 200) perfSamples.shift();
    }

    // Error tracking
    if (res.statusCode >= 400) {
      errorLog.push({ ts: Date.now(), route, status: res.statusCode, ip: maskIp(ip), ua });
      if (errorLog.length > 500) errorLog.shift();
    }
  });

  next();
}

// ── Device detection ──────────────────────────────────────────────────────────
function detectDevice(ua) {
  if (/iPhone|iPad|iPod/i.test(ua))  return 'iOS';
  if (/Android/i.test(ua))           return 'Android';
  if (/Windows/i.test(ua))           return 'Windows';
  if (/Macintosh|Mac OS/i.test(ua))  return 'macOS';
  if (/Linux/i.test(ua))             return 'Linux';
  return 'Unknown';
}

// ── Called when a stream starts ───────────────────────────────────────────────
function trackStreamStart(ip, streamId, name, type, ua) {
  const key = `${ip}_${streamId}_${Date.now()}`;
  activeStreams[key] = { key, ip: maskIp(ip), rawIp: ip, streamId, name, type, startTime: Date.now(), ua, device: detectDevice(ua) };

  // Update session's current stream
  if (sessions[ip]) sessions[ip].currentStream = { name, type, since: Date.now() };

  // Content stats
  if (!contentStats[name]) contentStats[name] = { count: 0, lastWatched: Date.now(), type };
  contentStats[name].count++;
  contentStats[name].lastWatched = Date.now();

  // Append to events log (append-only, don't load full file each time)
  try {
    const event = JSON.stringify({ ts: Date.now(), ip: maskIp(ip), streamId, name, type }) + '\n';
    fs.appendFileSync(EVENTS_FILE.replace('.json', '.ndjson'), event);
  } catch {}

  return key;
}

// ── Called when a stream ends ─────────────────────────────────────────────────
function trackStreamEnd(key, ip) {
  delete activeStreams[key];
  if (sessions[ip]) sessions[ip].currentStream = null;
}

// ── Expose getStats for the dashboard API route ───────────────────────────────
function getStats() {
  purgeStaleSessions();

  const now          = Date.now();
  const fiveMinAgo   = now - 5 * 60 * 1000;
  const onlineUsers  = Object.values(sessions).filter(s => s.lastSeen > fiveMinAgo);
  const streams      = Object.values(activeStreams);

  // Avg response time (last 50 samples)
  const recent = perfSamples.slice(-50);
  const avgMs  = recent.length ? Math.round(recent.reduce((a, b) => a + b.ms, 0) / recent.length) : 0;

  // Error rate (last hour)
  const oneHourAgo   = now - 3600_000;
  const recentErrors = errorLog.filter(e => e.ts > oneHourAgo);

  // Top content
  const topContent = Object.entries(contentStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([name, d]) => ({ name, ...d }));

  // Hourly watch histogram (last 24h)
  const watchNdjson = (() => {
    try {
      const f = EVENTS_FILE.replace('.json', '.ndjson');
      if (!fs.existsSync(f)) return [];
      return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    } catch { return []; }
  })();
  const dayAgo = now - 86400_000;
  const hourly = Array(24).fill(0);
  for (const ev of watchNdjson) {
    if (ev.ts > dayAgo) {
      const h = new Date(ev.ts).getHours();
      hourly[h]++;
    }
  }

  // Process uptime
  const uptimeSec = Math.floor(process.uptime());

  return {
    ts:           now,
    uptime:       uptimeSec,
    uptimeStr:    formatUptime(uptimeSec),
    memory:       process.memoryUsage(),
    nodeVersion:  process.version,
    activeUsers:  onlineUsers.length,
    users:        onlineUsers,
    activeStreams: streams,
    streamCount:  streams.length,
    avgResponseMs: avgMs,
    recentPerf:   perfSamples.slice(-100),
    errorCount:   recentErrors.length,
    recentErrors: errorLog.slice(-50).reverse(),
    topContent,
    hourlyWatches: hourly,
    totalWatches: watchNdjson.length,
  };
}

function formatUptime(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}

module.exports = { requestMiddleware, trackStreamStart, trackStreamEnd, getStats, maskIp };
