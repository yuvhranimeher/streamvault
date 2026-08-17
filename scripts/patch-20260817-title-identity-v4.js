'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');
const BACKUP = path.join(ROOT, 'server.js.before-20260817-title-identity-v4.bak');
const DETAIL_CACHE = path.join(ROOT, 'detail-cache.json');
const MARKER = 'SV_20260817_TITLE_IDENTITY_V4';

if (!fs.existsSync(SERVER)) {
  console.error('[Title Identity V4] server.js not found:', SERVER);
  process.exit(2);
}

let source = fs.readFileSync(SERVER, 'utf8');
if (source.includes(MARKER)) {
  console.log('[Title Identity V4] Already applied.');
  process.exit(0);
}

const cleanPattern = /function\s+cleanSearchTitle\s*\(\s*title\s*\)\s*\{[\s\S]*?\n\}/;
const splitPattern = /function\s+splitSearchTitleYear\s*\(\s*title\s*,\s*year\s*=\s*''\s*\)\s*\{[\s\S]*?\n\}/;

if (!cleanPattern.test(source)) {
  console.error('[Title Identity V4] cleanSearchTitle function not found. No changes written.');
  process.exit(3);
}
if (!splitPattern.test(source)) {
  console.error('[Title Identity V4] splitSearchTitleYear function not found. No changes written.');
  process.exit(4);
}
if (!source.includes('const clean = cleanSearchTitle(title).toLowerCase();')) {
  console.error('[Title Identity V4] pickTmdbResult lookup line not found. No changes written.');
  process.exit(5);
}

if (!fs.existsSync(BACKUP)) fs.copyFileSync(SERVER, BACKUP);

const identityHelper = `// ${MARKER}: keep year-like numbers that belong to a title when an explicit release year is supplied.\nfunction svDetailIdentityForLookup(title, fallbackYear = '') {\n  let raw = String(title || '')\n    .replace(/\\.[a-z0-9]{2,5}$/i, ' ')\n    .replace(/[._]+/g, ' ')\n    .replace(/\\s+/g, ' ')\n    .trim();\n\n  const explicitReleaseYear = String(fallbackYear || '').match(/(?:19|20)\\d{2}/)?.[0] || '';\n  const yearMatches = [...raw.matchAll(/\\b((?:19|20)\\d{2})\\b/g)];\n  const releaseYear = explicitReleaseYear || (yearMatches.length ? yearMatches[yearMatches.length - 1][1] : '');\n\n  if (releaseYear) {\n    const matches = [...raw.matchAll(new RegExp('\\\\b' + releaseYear + '\\\\b', 'g'))];\n    if (matches.length) {\n      const last = matches[matches.length - 1];\n      const candidate = (raw.slice(0, last.index) + raw.slice(last.index + last[0].length))\n        .replace(/[\\(\\)\\[\\]\\{\\}]+/g, ' ')\n        .replace(/\\s+/g, ' ')\n        .trim();\n      if (candidate && !/^\\d+$/.test(candidate)) raw = candidate;\n    }\n  }\n\n  raw = raw\n    .replace(/\\bS\\d{1,2}E\\d{1,3}\\b/ig, ' ')\n    .replace(/\\b(?:2160p|1080p|720p|540p|480p|4k|uhd|hdr|webrip|web-rip|webdl|web-dl|bluray|brrip|hdrip|hdtv|dvdrip|x264|x265|hevc|aac|dts|ac3|eac3|ddp|nf|amzn|hmax|dsnp|itunes|mkv|mp4|esub|msubs|dual audio|multi audio|hindi|english|bengali|bangla|spanish)\\b.*$/ig, ' ')\n    .replace(/[\\[\\]\\(\\)\\{\\}]+/g, ' ')\n    .replace(/\\s+/g, ' ')\n    .trim();\n\n  return { title: raw || String(title || '').trim(), year: releaseYear };\n}\n\nfunction cleanSearchTitle(title, year = '') {\n  return svDetailIdentityForLookup(title, year).title;\n}`;

source = source.replace(cleanPattern, identityHelper);
source = source.replace(splitPattern, `function splitSearchTitleYear(title, year = '') {\n  return svDetailIdentityForLookup(title, year);\n}`);
source = source.replace(
  'const clean = cleanSearchTitle(title).toLowerCase();',
  'const clean = cleanSearchTitle(title, year).toLowerCase();'
);

if (!source.includes(MARKER) || !source.includes('const clean = cleanSearchTitle(title, year).toLowerCase();')) {
  console.error('[Title Identity V4] Verification failed. No changes written.');
  process.exit(6);
}

fs.writeFileSync(SERVER, source, 'utf8');

let purged = 0;
try {
  if (fs.existsSync(DETAIL_CACHE)) {
    const parsed = JSON.parse(fs.readFileSync(DETAIL_CACHE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of Object.keys(parsed)) {
        const entryText = JSON.stringify(parsed[key] || '').toLowerCase();
        if (key.toLowerCase().includes('madrid') || entryText.includes('coldplay: unstaged live from madrid')) {
          delete parsed[key];
          purged++;
        }
      }
      if (purged) fs.writeFileSync(DETAIL_CACHE, JSON.stringify(parsed, null, 2));
    }
  }
} catch (error) {
  console.warn('[Title Identity V4] Detail-cache cleanup skipped:', error.message);
}

console.log('[Title Identity V4] Applied.');
console.log('[Title Identity V4] Backup:', BACKUP);
console.log('[Title Identity V4] Purged stale Madrid detail-cache entries:', purged);
