'use strict';

const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'server.js');
const source = fs.readFileSync(serverFile, 'utf8');

const oldBlock = `  const exactHits = terms.filter(t => nameTokens.includes(t)).length;
  const phraseHit = phrase && (name === phrase || name.startsWith(phrase + ' ') || name.includes(' ' + phrase + ' '));
  // Massive no-art entries must be very clearly relevant. Display caps are applied later.
  if (!svSearchHasArt(item) && !phraseHit && exactHits < terms.length) return true;`;

const newBlock = `  const searchTokens = entry.searchTokens || [];
  const exactHits = terms.filter(t => nameTokens.includes(t) || searchTokens.includes(t)).length;
  const phraseHit = phrase && (
    name === phrase ||
    name.startsWith(phrase + ' ') ||
    name.includes(' ' + phrase + ' ') ||
    (entry.search || '').includes(phrase)
  );
  // Massive no-art entries must be clearly relevant, but title-year/file metadata
  // matches are valid search hits even when canonical display names omit that metadata.
  if (!svSearchHasArt(item) && !phraseHit && exactHits < terms.length) return true;`;

if (source.includes(newBlock)) {
  console.log('[Search Patch] Already applied.');
  process.exit(0);
}

if (!source.includes(oldBlock)) {
  console.error('[Search Patch] Expected search filter block was not found; server.js was not changed.');
  process.exit(2);
}

fs.copyFileSync(serverFile, `${serverFile}.before-search-metadata-fix.bak`);
fs.writeFileSync(serverFile, source.replace(oldBlock, newBlock), 'utf8');
console.log('[Search Patch] Applied metadata-aware massive search filter.');
console.log('[Search Patch] Backup:', `${serverFile}.before-search-metadata-fix.bak`);
