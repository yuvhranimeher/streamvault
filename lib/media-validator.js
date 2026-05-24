const path = require('path');
const { normalizeTitle, extractYear, isReleaseJunk } = require('./normalize-title');
const { rejectMedia } = require('./rejected-media');

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v', '.mpg', '.mpeg', '.3gp']);
const REJECT_EXTS = new Set(['.txt', '.nfo', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.url', '.srt', '.ass', '.ssa']);
const MIN_VIDEO_BYTES = 100 * 1024 * 1024;

function filenameOf(item = {}) {
  const direct = item.filename || item.file || item.name || item.title || '';
  if (direct) return String(direct);
  try {
    return decodeURIComponent(path.posix.basename(new URL(item.streamUrl || item.url || '').pathname));
  } catch {
    return '';
  }
}

function mediaSize(item = {}) {
  return Number(item.size || item.bytes || item.length || item.fileSize || 0) || 0;
}

function validateMediaItem(item = {}, options = {}) {
  const filename = filenameOf(item);
  const ext = path.extname(filename.split('?')[0]).toLowerCase();
  const title = normalizeTitle(item.title || item.name || filename);
  const kind = options.kind || item.type || '';
  const size = mediaSize(item);
  const raw = `${filename} ${item.title || ''} ${item.name || ''}`.toLowerCase();

  let reason = '';
  if (!filename && !item.streamUrl && !item.url) reason = 'missing filename or stream url';
  else if (REJECT_EXTS.has(ext)) reason = 'unsupported metadata/image extension';
  else if (ext && !VIDEO_EXTS.has(ext) && !options.allowFolders) reason = 'unsupported playable extension';
  else if (/\b(sample|trailer|teaser|promo|preview|behind[ ._-]?the[ ._-]?scenes)\b/i.test(raw)) reason = 'sample or trailer file';
  else if (size > 0 && VIDEO_EXTS.has(ext) && size < MIN_VIDEO_BYTES) reason = 'tiny video file under 100MB';
  else if (!title || title.length < 3) reason = 'title shorter than 3 chars';
  else if (/^\d+$/.test(title)) reason = 'pure numeric title';
  else if (isReleaseJunk(title || filename)) reason = 'filename contains only release or codec tags';
  else if (kind === 'series' && options.requireEpisodes && !options.episodeCount) reason = 'season folder without episodes';
  else if (kind === 'episode' && !/\bS\d{1,2}E\d{1,3}\b/i.test(raw) && /\b(part|cd|disc)\s*\d{1,3}\b/i.test(raw)) reason = 'isolated episode fragment';

  if (reason) {
    rejectMedia(reason, item, { normalizedTitle: title, year: extractYear(raw) });
    return { ok: false, reason, title, year: extractYear(raw) };
  }
  return { ok: true, title, year: extractYear(raw), ext };
}

function isValidMediaItem(item, options) {
  return validateMediaItem(item, options).ok;
}

module.exports = {
  validateMediaItem,
  isValidMediaItem,
  VIDEO_EXTS,
  REJECT_EXTS,
  MIN_VIDEO_BYTES
};
