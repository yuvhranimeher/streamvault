'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');
const BACKUP = path.join(ROOT, 'server.js.before-20260817-playback-metadata.bak');
const MARKER = 'SV_20260817_PLAYBACK_METADATA_FIX';

if (!fs.existsSync(SERVER)) {
  console.error('[Playback/Metadata Patch] server.js not found:', SERVER);
  process.exit(2);
}

let source = fs.readFileSync(SERVER, 'utf8');
if (source.includes(MARKER)) {
  console.log('[Playback/Metadata Patch] Already applied.');
  process.exit(0);
}

if (!fs.existsSync(BACKUP)) fs.copyFileSync(SERVER, BACKUP);

let changes = 0;

const yearReplacement = `function svExtractYear(value) {
  // ${MARKER}: prefer an explicit/bracketed release year over a year that is part of the title.
  const text = svSafeDecode(value || '');
  const bracketed = [...text.matchAll(/[\\(\\[\\{]\\s*((?:19|20)\\d{2})\\s*[\\)\\]\\}]/g)];
  if (bracketed.length) return bracketed[bracketed.length - 1][1];
  const matches = [...text.matchAll(/(?:^|[^0-9])((?:19|20)\\d{2})(?=[^0-9]|$)/g)];
  if (!matches.length) return '';
  return matches[matches.length - 1][1];
}`;

source = source.replace(/function svExtractYear\(value\) \{[\s\S]*?\n\}/, match => {
  changes++;
  return yearReplacement;
});

const detailReplacement = `function normalizeDetailTitle(title, fallbackYear = '') {
  let raw = String(title || '')
    .replace(/\\.[a-z0-9]{2,5}$/i, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

  let year = String(fallbackYear || '').match(/(?:19|20)\\d{2}/)?.[0] || '';
  const bracketedYears = [...raw.matchAll(/[\\(\\[\\{]\\s*((?:19|20)\\d{2})\\s*[\\)\\]\\}]/g)];
  if (!year && bracketedYears.length) year = bracketedYears[bracketedYears.length - 1][1];
  if (!year) {
    const yearMatches = [...raw.matchAll(/\\b((?:19|20)\\d{2})\\b/g)];
    if (yearMatches.length) year = yearMatches[yearMatches.length - 1][1];
  }

  if (year) {
    const bracketedRelease = new RegExp('[\\\\(\\\\[\\\\{]\\\\s*' + year + '\\\\s*[\\\\)\\\\]\\\\}]', 'g');
    raw = raw.replace(bracketedRelease, ' ');
  }

  raw = raw
    .replace(/\\bS\\d{1,2}E\\d{1,3}\\b/ig, ' ')
    .replace(/\\[[^\\]]*\\]|\\([^\\)]*(?:Hindi|English|Dual Audio|Audio|ESub|MSubs|WEBRip|BluRay|x264|x265|HEVC|AAC|NF|AMZN|HMAX|DSNP|WEB-DL|HDRip|BRRip)[^\\)]*\\)/ig, ' ')
    .replace(/\\b(2160p|1080p|720p|540p|480p|4k|uhd|hdr|webrip|web-rip|webdl|web-dl|bluray|brrip|hdrip|hdtv|dvdrip|x264|x265|hevc|aac|dts|ddp?5\\.1|5\\.1|7\\.1|nf|amzn|hmax|dsnp|itunes|mkv|mp4|mkvC|mkvCinemas|msmod|pahe|rarbg|yts|galaxyrg|esub|msubs|dual audio|multi audio|hindi|english|bengali|bangla)\\b.*$/ig, ' ')
    .replace(/[^\\p{L}\\p{N}:'&!?, -]+/gu, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

  // Remove only the release-year occurrence, preserving title years such as "Madrid, 1987".
  if (year) {
    const releaseYear = new RegExp('\\\\b' + year + '\\\\b', 'g');
    const occurrences = [...raw.matchAll(releaseYear)];
    if (occurrences.length) {
      const last = occurrences[occurrences.length - 1];
      const candidate = (raw.slice(0, last.index) + raw.slice(last.index + last[0].length))
        .replace(/\\s+/g, ' ')
        .trim();
      if (candidate) raw = candidate;
    }
  }

  return { title: raw, year };
}`;

const detailPattern = /function normalizeDetailTitle\(title, fallbackYear = ''\) \{[\s\S]*?\n\}\n\nfunction normalizedTitleKey/;
if (!detailPattern.test(source)) {
  console.error('[Playback/Metadata Patch] normalizeDetailTitle block not found. No changes written.');
  process.exit(3);
}
source = source.replace(detailPattern, () => {
  changes++;
  return detailReplacement + '\n\nfunction normalizedTitleKey';
});

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
    // Skip subtitle crawling and decoded-audio validation so playback can attach immediately.
    if (startupProbe) {
      const audioTracks = Array.isArray(info.audioTracks) ? info.audioTracks : [];
      const selectedAudio = firstPlayableAudioStream(audioTracks);
      const audioIndex = selectedAudio ? audioTracks.indexOf(selectedAudio) : null;
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

if (!source.includes(oldMediaInfo)) {
  console.error('[Playback/Metadata Patch] FTP media-info block not found. No changes written.');
  process.exit(4);
}
source = source.replace(oldMediaInfo, newMediaInfo);
changes++;

if (changes !== 3 || !source.includes(MARKER)) {
  console.error(`[Playback/Metadata Patch] Expected 3 changes, got ${changes}. No changes written.`);
  process.exit(5);
}

fs.writeFileSync(SERVER, source, 'utf8');
console.log('[Playback/Metadata Patch] Applied.');
console.log('[Playback/Metadata Patch] Backup:', BACKUP);
