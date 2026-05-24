const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(process.cwd(), 'rejected-media.json');
let buffer = [];
let flushTimer = null;
const seenThisRun = new Set();

function readExisting(file) {
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch {}
  return [];
}

function flush(file = DEFAULT_FILE) {
  if (!buffer.length) return;
  const items = buffer;
  buffer = [];
  try {
    const existing = readExisting(file);
    const byKey = new Map();
    [...existing, ...items].forEach(item => {
      const key = `${item.reason}|${item.filename || item.title || item.id || item.normalizedTitle || ''}`;
      byKey.set(key, item);
    });
    fs.writeFileSync(file, JSON.stringify(Array.from(byKey.values()).slice(-5000), null, 2), 'utf8');
  } catch {}
}

function rejectMedia(reason, item = {}, extra = {}) {
  const dedupeKey = `${reason}|${item.filename || item.file || item.name || item.title || extra.normalizedTitle || ''}`;
  if (seenThisRun.has(dedupeKey)) return;
  seenThisRun.add(dedupeKey);
  if (buffer.length > 2000) return;
  buffer.push({
    time: new Date().toISOString(),
    reason,
    filename: item.filename || item.file || item.name || item.title || '',
    title: item.title || item.name || '',
    normalizedTitle: item.normalizedTitle || '',
    tmdbId: item.tmdbId || null,
    streamUrl: item.streamUrl || item.url || '',
    ...extra
  });
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, 1000);
    if (flushTimer.unref) flushTimer.unref();
  }
}

module.exports = { rejectMedia, flush };
