'use strict';

const fs = require('fs');
const path = require('path');

const serverPath = path.resolve(__dirname, '..', 'server.js');
const backupPath = path.resolve(__dirname, '..', 'server.js.before-audio-default-english-v3.bak');
let src = fs.readFileSync(serverPath, 'utf8');

const MARKER = 'SV_AUDIO_DEFAULT_ENGLISH_V3';
if (src.includes(MARKER)) {
  console.log('[Audio Default English V3] already applied');
  process.exit(0);
}

if (!fs.existsSync(backupPath)) fs.copyFileSync(serverPath, backupPath);

const anchor = "async function resolvePlaybackAudioSelection(req, input, label = 'media') {";
if (!src.includes(anchor)) {
  console.error('[Audio Default English V3] resolver anchor not found');
  process.exit(2);
}

const helper = `// SV_AUDIO_DEFAULT_ENGLISH_V3\nconst ftpPreferredAudioValidationCache = new Map();\n\nfunction serverAudioTrackIsEnglish(track = {}) {\n  const lang = String(track.language || track.lang || '').trim().toLowerCase();\n  const title = String(track.title || track.label || '').trim().toLowerCase();\n  return /^(eng|en|english)$/.test(lang) || /(?:^|[^a-z])english(?:[^a-z]|$)/i.test(title);\n}\n\nfunction preferredPlayableAudioStream(tracks = []) {\n  const list = Array.isArray(tracks) ? tracks : [];\n  return list.find(track => serverAudioTrackIsEnglish(track) && firstPlayableAudioStream([track]) === track) || null;\n}\n\nasync function preferredValidDecodedAudioStream(input, tracks = [], title = 'FTP media') {\n  const list = Array.isArray(tracks) ? tracks : [];\n  const key = mediaStableCacheKey(input);\n  const cached = ftpPreferredAudioValidationCache.get(key);\n  if (cached) return cached;\n\n  const promise = (async () => {\n    const english = list\n      .map((track, index) => ({ track, index }))\n      .filter(row => serverAudioTrackIsEnglish(row.track) && firstPlayableAudioStream([row.track]) === row.track);\n\n    for (const row of english) {\n      const decoded = await decodeFtpAudioStream(input, row.track);\n      if (!decoded.decodable || !decoded.audioPacketsDetected || decoded.decodedFrames <= 0) continue;\n      const selectedTrack = {\n        ...row.track,\n        bitrate: Number(row.track.bitrate) > 0 ? Number(row.track.bitrate) : Number(decoded.measuredBitrate) || 0,\n        audioPacketsDetected: true,\n        decodedAudioFrames: Number(decoded.decodedFrames) || 0,\n        decodedPeakSample: Number(decoded.peakSample) || 0,\n        decodable: true,\n        validationReason: 'preferred English decoded stream',\n      };\n      const ftpStreams = list.map((track, index) => index === row.index ? selectedTrack : ({\n        ...track,\n        decodable: null,\n        validationReason: 'not tested after preferred English stream',\n      }));\n      const result = {\n        ftpStreams,\n        validAudioStreams: [selectedTrack],\n        selectedTrack,\n        selectedIndex: row.index,\n      };\n      console.log('[FTP AUDIO DEFAULT]', { title, selectedIndex: row.index, language: selectedTrack.language || '', titleTag: selectedTrack.title || '', reason: 'preferred-English' });\n      return result;\n    }\n\n    const fallback = await firstValidDecodedAudioStream(input, list, title);\n    console.log('[FTP AUDIO DEFAULT]', { title, selectedIndex: fallback.selectedIndex, reason: 'first-valid-fallback' });\n    return fallback;\n  })().catch(error => {\n    ftpPreferredAudioValidationCache.delete(key);\n    throw error;\n  });\n\n  ftpPreferredAudioValidationCache.set(key, promise);\n  if (ftpPreferredAudioValidationCache.size > 120) {\n    const oldest = ftpPreferredAudioValidationCache.keys().next().value;\n    if (oldest !== key) ftpPreferredAudioValidationCache.delete(oldest);\n  }\n  return promise;\n}\n\n`;

src = src.replace(anchor, helper + anchor);

const oldFtpBlock = `  if (isFtpInput) {\n    const validated = await firstValidDecodedAudioStream(input, tracks, label);\n    const selectedTrack = validated.selectedTrack;\n    if (!selectedTrack) return selection;\n    return {\n      ...selectionFromAbsoluteAudio(req, selectedTrack, 'ftp-decoded-stream', videoStartTime, videoStreamIdx, info?.videoCodec || ''),\n      defaultAudioIndex: validated.selectedIndex,\n      audioIndex: validated.selectedIndex,\n      ftpAudioValidated: true,\n    };\n  }`;

const newFtpBlock = `  if (isFtpInput) {\n    // An absolute stream selection comes from the user's Audio button and must win.\n    if (selection.audioStreamIdx !== null) {\n      const requested = tracks.find(track => serverAudioTrackAbsoluteIndex(track) === selection.audioStreamIdx);\n      if (requested && firstPlayableAudioStream([requested]) === requested) {\n        const requestedIndex = tracks.indexOf(requested);\n        return {\n          ...selectionFromAbsoluteAudio(req, requested, 'ftp-user-selected-stream', videoStartTime, videoStreamIdx, info?.videoCodec || ''),\n          defaultAudioIndex: requestedIndex,\n          audioIndex: requestedIndex,\n          ftpAudioValidated: true,\n        };\n      }\n    }\n\n    // Global default: prefer a valid English track. If none exists, use the first valid track.\n    const validated = await preferredValidDecodedAudioStream(input, tracks, label);\n    const selectedTrack = validated.selectedTrack;\n    if (!selectedTrack) return selection;\n    return {\n      ...selectionFromAbsoluteAudio(req, selectedTrack, 'ftp-preferred-default', videoStartTime, videoStreamIdx, info?.videoCodec || ''),\n      defaultAudioIndex: validated.selectedIndex,\n      audioIndex: validated.selectedIndex,\n      ftpAudioValidated: true,\n    };\n  }`;

if (!src.includes(oldFtpBlock)) {
  console.error('[Audio Default English V3] FTP resolver block not found');
  process.exit(3);
}
src = src.replace(oldFtpBlock, newFtpBlock);

const genericOld = '  if (!selectedTrack) selectedTrack = firstPlayableAudioStream(tracks);';
const genericNew = '  if (!selectedTrack) selectedTrack = preferredPlayableAudioStream(tracks) || firstPlayableAudioStream(tracks);';
let genericCount = 0;
while (src.includes(genericOld) && genericCount < 4) {
  src = src.replace(genericOld, genericNew);
  genericCount += 1;
}
if (genericCount < 2) {
  console.error('[Audio Default English V3] expected generic default-selection blocks were not found');
  process.exit(4);
}

const mediaInfoOld = 'const validatedAudio = await firstValidDecodedAudioStream(media.decodedUrl, info.audioTracks, kghkTitle);';
const mediaInfoNew = 'const validatedAudio = await preferredValidDecodedAudioStream(media.decodedUrl, info.audioTracks, kghkTitle);';
if (!src.includes(mediaInfoOld)) {
  console.error('[Audio Default English V3] media-info default block not found');
  process.exit(5);
}
src = src.replace(mediaInfoOld, mediaInfoNew);

fs.writeFileSync(serverPath, src, 'utf8');
console.log('[Audio Default English V3] applied');
console.log('[Audio Default English V3] generic defaults patched:', genericCount);
console.log('[Audio Default English V3] backup:', backupPath);
