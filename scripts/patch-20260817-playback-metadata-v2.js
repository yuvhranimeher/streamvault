'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');
const BACKUP = path.join(ROOT, 'server.js.before-20260817-playback-metadata-v2.bak');
const MARKER = 'SV_20260817_PLAYBACK_METADATA_V2';

if (!fs.existsSync(SERVER)) {
  console.error('[Playback/Metadata V2] server.js not found:', SERVER);
  process.exit(2);
}

let source = fs.readFileSync(SERVER, 'utf8');
if (source.includes(MARKER)) {
  console.log('[Playback/Metadata V2] Already applied.');
  process.exit(0);
}
if (!fs.existsSync(BACKUP)) fs.copyFileSync(SERVER, BACKUP);

function replaceNamedFunction(text, name, replacement) {
  const needle = `function ${name}(`;
  const start = text.indexOf(needle);
  if (start < 0) return null;
  const braceStart = text.indexOf('{', start);
  if (braceStart < 0) return null;
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = braceStart; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(0, start) + replacement + text.slice(i + 1);
    }
  }
  return null;
}

let changes = 0;

const yearFunction = `function svExtractYear(value) {
  // ${MARKER}: prefer the explicit/bracketed release year; otherwise use the last year token.
  const text = svSafeDecode(value || '');
  const bracketed = [...text.matchAll(/[\\(\\[\\{]\\s*((?:19|20)\\d{2})\\s*[\\)\\]\\}]/g)];
  if (bracketed.length) return bracketed[bracketed.length - 1][1];
  const matches = [...text.matchAll(/(?:^|[^0-9])((?:19|20)\\d{2})(?=[^0-9]|$)/g)];
  return matches.length ? matches[matches.length - 1][1] : '';
}`;

const yearPatched = replaceNamedFunction(source, 'svExtractYear', yearFunction);
if (!yearPatched) {
  console.error('[Playback/Metadata V2] svExtractYear not found. No changes written.');
  process.exit(3);
}
source = yearPatched;
changes++;

const oldMediaInfo = `    const audioOnly = req.query.audioOnly === '1';
    const [info, sidecarSubtitleTracks] = await Promise.all([
      audioOnly ? getCachedAudioOnlyMediaInfo(media.decodedUrl) : getCachedMediaInfo(media.decodedUrl),
      audioOnly ? Promise.resolve([]) : discoverRemoteSubtitleTracks(media.decodedUrl, req).catch(() => [])
    ]);
    if (audioOnly && req.query.playbackType === 'media') {`;

const newMediaInfo = `    const audioOnly = req.query.audioOnly === '1';
    const startupProbe = req.query.startup === '1';
    const [info, sidecarSubtitleTracks] = await Promise.all([
      audioOnly ? getCachedAudioOnlyMediaInfo(media.decodedUrl) : getCachedMediaInfo(media.decodedUrl),
      (audioOnly || startupProbe) ? Promise.resolve([]) : discoverRemoteSubtitleTracks(media.decodedUrl, req).catch(() => [])
    ]);

    // ${MARKER}: startup only needs container/codec/duration/audio metadata.
    // Skip subtitle crawling and decoded-audio validation so the compatible stream can attach immediately.
    if (startupProbe) {
      const audioTracks = Array.isArray(info.audioTracks) ? info.audioTracks : [];
      const audioIndex = audioTracks.length ? 0 : null;
      return res.json({
        ok: true,
        requestedUrl: media.requestedUrl,
        decodedUrl: media.decodedUrl,
        matchedCatalogItem: matched,
        playUrl: urls.finalPlayUrl,
        finalPlayUrl: urls.finalPlayUrl,
        ...info,
        audioTracks,
        sidecarSubtitleTracks: [],
        duration: Number(info.duration) || 0,
        ...(audioIndex !== null ? { audioIndex, defaultAudioIndex: audioIndex } : {}),
        ftpAudioValidated: false,
        startupProbe: true,
      });
    }

    if (audioOnly && req.query.playbackType === 'media') {`;

if (source.includes(oldMediaInfo)) {
  source = source.replace(oldMediaInfo, newMediaInfo);
  changes++;
} else if (!source.includes('const startupProbe = req.query.startup')) {
  console.error('[Playback/Metadata V2] FTP media-info block not found. No changes written.');
  process.exit(4);
}

if (!source.includes('forceCircleFtpCompatibility')) {
  const oldCopyVideo = `  const copyVideo = !smoothPlayback && !mobilePlayback && isRemoteDirectPlayable(srcUrl) && remoteVideoCanCopy(srcUrl);`;
  const newCopyVideo = `  const forceCircleFtpCompatibility = (() => {
    try { return /(^|\\.)circleftp\\.net$/i.test(new URL(srcUrl).hostname); }
    catch { return /circleftp\\.net/i.test(String(srcUrl || '')); }
  })();
  const copyVideo = !forceCircleFtpCompatibility && !smoothPlayback && !mobilePlayback && isRemoteDirectPlayable(srcUrl) && remoteVideoCanCopy(srcUrl);`;
  if (source.includes(oldCopyVideo)) {
    source = source.replace(oldCopyVideo, newCopyVideo);
    changes++;
  }
}

if (!source.includes(MARKER) || changes < 2) {
  console.error(`[Playback/Metadata V2] Expected at least 2 changes, got ${changes}. No changes written.`);
  process.exit(5);
}

fs.writeFileSync(SERVER, source, 'utf8');
console.log(`[Playback/Metadata V2] Applied ${changes} change(s).`);
console.log('[Playback/Metadata V2] Backup:', BACKUP);
