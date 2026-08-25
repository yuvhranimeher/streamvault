'use strict';

const fs = require('fs');
const path = require('path');

const serverPath = path.resolve(__dirname, '..', 'server.js');
const backupPath = path.resolve(__dirname, '..', 'server.js.before-audio-authority-v4.bak');
let src = fs.readFileSync(serverPath, 'utf8');

const MARKER = 'SV_AUDIO_AUTHORITY_V4';
if (src.includes(MARKER)) {
  console.log('[Audio Authority V4] already applied');
  process.exit(0);
}

if (!fs.existsSync(backupPath)) fs.copyFileSync(serverPath, backupPath);

const resolverAnchor = "async function resolvePlaybackAudioSelection(req, input, label = 'media') {";
const resolverStart = src.indexOf(resolverAnchor);
if (resolverStart < 0) {
  console.error('[Audio Authority V4] resolvePlaybackAudioSelection not found');
  process.exit(2);
}

const kghkAnchor = "  if (isKghk) {";
const kghkPos = src.indexOf(kghkAnchor, resolverStart);
if (kghkPos < 0) {
  console.error('[Audio Authority V4] isKghk block not found');
  process.exit(3);
}

const ftpStart = src.indexOf("  if (isFtpInput) {", resolverStart);
if (ftpStart < 0 || ftpStart > kghkPos) {
  console.error('[Audio Authority V4] FTP resolver block not found');
  process.exit(4);
}

// Find the end of the FTP if-block using brace depth so this works whether V3 is present or not.
let depth = 0;
let ftpEnd = -1;
for (let i = ftpStart; i < kghkPos; i++) {
  const ch = src[i];
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) {
      ftpEnd = i + 1;
      break;
    }
  }
}
if (ftpEnd < 0) {
  console.error('[Audio Authority V4] could not parse FTP resolver block');
  process.exit(5);
}

const helper = `// SV_AUDIO_AUTHORITY_V4\nfunction svAudioTrackLanguageV4(track = {}) {\n  const raw = [track.language, track.lang, track.title, track.label, track.name]\n    .filter(Boolean).join(' ').toLowerCase();\n  if (/(?:^|[^a-z])(eng|en|english)(?:[^a-z]|$)/i.test(raw)) return 'en';\n  if (/(?:^|[^a-z])(hin|hi|hindi)(?:[^a-z]|$)/i.test(raw)) return 'hi';\n  return '';\n}\n\nfunction svEnglishPlayableTrackV4(tracks = []) {\n  const list = Array.isArray(tracks) ? tracks : [];\n  return list.find(track =>\n    svAudioTrackLanguageV4(track) === 'en' &&\n    firstPlayableAudioStream([track]) === track\n  ) || null;\n}\n\nfunction svManualAudioRequestV4(req) {\n  const reason = String(req?.query?.fallbackReason || '').toLowerCase();\n  return /audio\\s*switch|manual\\s*audio|user\\s*audio/.test(reason);\n}\n\n`;

src = src.slice(0, resolverStart) + helper + src.slice(resolverStart);

// Recalculate offsets after helper insertion.
const newResolverStart = src.indexOf(resolverAnchor);
const newKghkPos = src.indexOf(kghkAnchor, newResolverStart);
const newFtpStart = src.indexOf("  if (isFtpInput) {", newResolverStart);
let d = 0;
let newFtpEnd = -1;
for (let i = newFtpStart; i < newKghkPos; i++) {
  const ch = src[i];
  if (ch === '{') d++;
  else if (ch === '}') {
    d--;
    if (d === 0) {
      newFtpEnd = i + 1;
      break;
    }
  }
}
if (newFtpEnd < 0) {
  console.error('[Audio Authority V4] could not re-parse FTP resolver block');
  process.exit(6);
}

const ftpBlock = `  if (isFtpInput) {\n    // The frontend may send the source container's default stream during startup.\n    // That is NOT a user choice. Only an explicit audio-switch request is manual.\n    const manualRequest = svManualAudioRequestV4(req);\n\n    if (manualRequest && selection.audioStreamIdx !== null) {\n      const requested = tracks.find(track => serverAudioTrackAbsoluteIndex(track) === selection.audioStreamIdx);\n      if (requested && firstPlayableAudioStream([requested]) === requested) {\n        const requestedIndex = tracks.indexOf(requested);\n        console.log('[AUDIO AUTHORITY V4]', { label, mode:'manual', selectedIndex:requestedIndex, streamIndex:selection.audioStreamIdx, language:svAudioTrackLanguageV4(requested) });\n        return {\n          ...selectionFromAbsoluteAudio(req, requested, 'ftp-manual-audio-switch', videoStartTime, videoStreamIdx, info?.videoCodec || ''),\n          defaultAudioIndex: requestedIndex,\n          audioIndex: requestedIndex,\n          ftpAudioValidated: true,\n        };\n      }\n    }\n\n    // Global default: English wins whenever a playable English track exists.\n    // Ignore container default flags and startup audioStream=... values.\n    let selectedTrack = svEnglishPlayableTrackV4(tracks);\n    let selectedIndex = selectedTrack ? tracks.indexOf(selectedTrack) : -1;\n\n    if (selectedTrack) {\n      try {\n        const decoded = await decodeFtpAudioStream(input, selectedTrack);\n        if (!decoded.decodable || !decoded.audioPacketsDetected || decoded.decodedFrames <= 0) {\n          selectedTrack = null;\n          selectedIndex = -1;\n        }\n      } catch (_) {\n        selectedTrack = null;\n        selectedIndex = -1;\n      }\n    }\n\n    if (!selectedTrack) {\n      const validated = await firstValidDecodedAudioStream(input, tracks, label);\n      selectedTrack = validated.selectedTrack;\n      selectedIndex = validated.selectedIndex;\n    }\n\n    if (!selectedTrack) return selection;\n\n    console.log('[AUDIO AUTHORITY V4]', {\n      label,\n      mode:'automatic',\n      selectedIndex,\n      streamIndex:serverAudioTrackAbsoluteIndex(selectedTrack),\n      language:svAudioTrackLanguageV4(selectedTrack),\n      available:tracks.map((track,index)=>({index,streamIndex:serverAudioTrackAbsoluteIndex(track),language:svAudioTrackLanguageV4(track),tag:track.language||track.lang||'',title:track.title||''}))\n    });\n\n    return {\n      ...selectionFromAbsoluteAudio(req, selectedTrack, 'ftp-english-authority-v4', videoStartTime, videoStreamIdx, info?.videoCodec || ''),\n      defaultAudioIndex: selectedIndex,\n      audioIndex: selectedIndex,\n      ftpAudioValidated: true,\n    };\n  }`;

src = src.slice(0, newFtpStart) + ftpBlock + src.slice(newFtpEnd);

// Apply the same English-first default to non-FTP mapped playback where no manual stream was requested.
const genericOld = "  if (!selectedTrack) selectedTrack = firstPlayableAudioStream(tracks);";
const genericNew = "  if (!selectedTrack) selectedTrack = svEnglishPlayableTrackV4(tracks) || firstPlayableAudioStream(tracks);";
let genericCount = 0;
while (src.includes(genericOld) && genericCount < 6) {
  src = src.replace(genericOld, genericNew);
  genericCount++;
}

fs.writeFileSync(serverPath, src, 'utf8');
console.log('[Audio Authority V4] applied');
console.log('[Audio Authority V4] non-FTP defaults patched:', genericCount);
console.log('[Audio Authority V4] backup:', backupPath);
