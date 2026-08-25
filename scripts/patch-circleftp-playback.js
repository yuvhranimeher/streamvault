'use strict';

const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'server.js');
let source = fs.readFileSync(serverFile, 'utf8');
let changed = false;

function functionSlice(marker) {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const braceStart = source.indexOf('{', start);
  if (braceStart < 0) return null;
  let depth = 0;
  let quote = null;
  let escape = false;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
    }
  }
  return null;
}

// 1) CircleFTP is now part of the generated StreamVault catalog, so allow those
// hosts through the compatibility playback routes.
const trust = functionSlice('function isTrustedRemotePlaybackUrl');
if (!trust) {
  console.error('[CircleFTP Playback Patch] isTrustedRemotePlaybackUrl() not found.');
  process.exit(2);
}
if (!/(?:circleftp\\\.net|circleftp\.net)/i.test(trust.text)) {
  const hostLine = /(\s*const\s+host\s*=\s*parsed\.hostname\.toLowerCase\(\)\s*;)/;
  if (!hostLine.test(trust.text)) {
    console.error('[CircleFTP Playback Patch] host declaration not found in trust function.');
    process.exit(2);
  }
  const patchedTrust = trust.text.replace(hostLine, `$1\n    if (/(?:^|\\.)circleftp\\.net$/i.test(host)) return true;`);
  source = source.slice(0, trust.start) + patchedTrust + source.slice(trust.end);
  changed = true;
}

// 2) /api/ftp/stream is the browser-compatibility fallback. CircleFTP contains
// some files whose extension lies about the real container/codec (for example a
// .mp4 URL containing Matroska + MPEG-4 Visual). Never stream-copy video for a
// CircleFTP fallback; force the existing libx264/AAC compatibility path instead.
const copyVideoPattern = /const\s+copyVideo\s*=\s*!smoothPlayback\s*&&\s*!mobilePlayback\s*&&\s*isRemoteDirectPlayable\(srcUrl\)\s*&&\s*remoteVideoCanCopy\(srcUrl\)\s*;/;
if (copyVideoPattern.test(source)) {
  source = source.replace(copyVideoPattern, `const forceCircleFtpCompatibility = (() => {\n    try { return /(?:^|\\.)circleftp\\.net$/i.test(new URL(srcUrl).hostname); } catch (_) { return false; }\n  })();\n  const copyVideo = !forceCircleFtpCompatibility && !smoothPlayback && !mobilePlayback && isRemoteDirectPlayable(srcUrl) && remoteVideoCanCopy(srcUrl);`);
  changed = true;
} else if (!source.includes('forceCircleFtpCompatibility')) {
  console.error('[CircleFTP Playback Patch] /api/ftp/stream copyVideo decision was not found.');
  process.exit(2);
}

if (!changed) {
  console.log('[CircleFTP Playback Patch] Already applied.');
  process.exit(0);
}

const backup = `${serverFile}.before-circleftp-playback-fix.bak`;
if (!fs.existsSync(backup)) fs.copyFileSync(serverFile, backup);
fs.writeFileSync(serverFile, source, 'utf8');
console.log('[CircleFTP Playback Patch] Applied.');
console.log('[CircleFTP Playback Patch] CircleFTP trusted for compatibility playback.');
console.log('[CircleFTP Playback Patch] CircleFTP fallback video will transcode to H.264/AAC.');
console.log('[CircleFTP Playback Patch] Backup:', backup);
