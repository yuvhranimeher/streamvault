'use strict';

const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'server.js');
let source = fs.readFileSync(serverFile, 'utf8');

const marker = 'function svShouldDropSearchResult';
const start = source.indexOf(marker);
if (start < 0) {
  console.error('[Search Patch] svShouldDropSearchResult() was not found; server.js was not changed.');
  process.exit(2);
}

// Find the end of this small function by brace depth. This is intentionally
// independent of whitespace/comments so it works against older production copies.
const braceStart = source.indexOf('{', start);
if (braceStart < 0) {
  console.error('[Search Patch] Could not locate search filter function body.');
  process.exit(2);
}
let depth = 0;
let end = -1;
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
    if (depth === 0) { end = i + 1; break; }
  }
}
if (end < 0) {
  console.error('[Search Patch] Could not determine end of search filter function.');
  process.exit(2);
}

let fn = source.slice(start, end);
if (fn.includes('searchTokens.includes(t)')) {
  console.log('[Search Patch] Already applied.');
  process.exit(0);
}

const nameTokensLine = /(\s*)const nameTokens\s*=\s*entry\.nameTokens\s*\|\|\s*\[\]\s*;/;
if (!nameTokensLine.test(fn)) {
  console.error('[Search Patch] nameTokens declaration was not found in search filter; server.js was not changed.');
  process.exit(2);
}
fn = fn.replace(nameTokensLine, (m, indent) => `${m}\n${indent}const searchTokens = entry.searchTokens || [];`);

const oldExact = /terms\.filter\(\s*t\s*=>\s*nameTokens\.includes\(t\)\s*\)\.length/;
if (!oldExact.test(fn)) {
  console.error('[Search Patch] exact-hit expression was not found in search filter; server.js was not changed.');
  process.exit(2);
}
fn = fn.replace(oldExact, 'terms.filter(t => nameTokens.includes(t) || searchTokens.includes(t)).length');

const backup = `${serverFile}.before-search-metadata-fix.bak`;
fs.copyFileSync(serverFile, backup);
source = source.slice(0, start) + fn + source.slice(end);
fs.writeFileSync(serverFile, source, 'utf8');
console.log('[Search Patch] Applied metadata-aware massive search filter.');
console.log('[Search Patch] Backup:', backup);
