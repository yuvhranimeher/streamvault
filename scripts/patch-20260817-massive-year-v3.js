'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');
const BACKUP = path.join(ROOT, 'server.js.before-20260817-massive-year-v3.bak');
const MARKER = 'SV_20260817_MASSIVE_YEAR_V3';

if (!fs.existsSync(SERVER)) {
  console.error('[Massive Year V3] server.js not found:', SERVER);
  process.exit(2);
}

let source = fs.readFileSync(SERVER, 'utf8');
if (source.includes(MARKER)) {
  console.log('[Massive Year V3] Already applied.');
  process.exit(0);
}

const anchor = 'function svStableId(prefix, value) {';
if (!source.includes(anchor)) {
  console.error('[Massive Year V3] svStableId anchor not found. No changes written.');
  process.exit(3);
}

const oldYearLine = '      const year = svExtractYear(item.title || url);';
const yearLineCount = source.split(oldYearLine).length - 1;
if (yearLineCount !== 1) {
  console.error(`[Massive Year V3] Expected exactly one massive year line, found ${yearLineCount}. No changes written.`);
  process.exit(4);
}

const helper = `// ${MARKER}: massive catalog filenames may contain a year as part of the title\n// followed by a bracketed release year, e.g. Madrid, 1987 (2011).\nfunction svExtractMassiveReleaseYear(value) {\n  const text = svSafeDecode(value || '')\n    .split(/[?#]/)[0]\n    .replace(/\\\\/g, '/')\n    .split('/')\n    .pop() || '';\n\n  const wrapped = [...text.matchAll(/[\\(\\[\\{]\\s*((?:19|20)\\d{2})\\s*[\\)\\]\\}]/g)];\n  if (wrapped.length) return wrapped[wrapped.length - 1][1];\n\n  const years = [...text.matchAll(/(?:^|[^0-9])((?:19|20)\\d{2})(?=[^0-9]|$)/g)]\n    .map(match => match[1]);\n  return years.length ? years[years.length - 1] : '';\n}\n\n`;

source = source.replace(anchor, helper + anchor);
source = source.replace(oldYearLine, '      const year = svExtractMassiveReleaseYear(item.title || url);');

if (!source.includes(MARKER) || !source.includes('const year = svExtractMassiveReleaseYear(item.title || url);')) {
  console.error('[Massive Year V3] Verification failed. No changes written.');
  process.exit(5);
}

if (!fs.existsSync(BACKUP)) fs.copyFileSync(SERVER, BACKUP);
fs.writeFileSync(SERVER, source, 'utf8');
console.log('[Massive Year V3] Applied.');
console.log('[Massive Year V3] Backup:', BACKUP);
