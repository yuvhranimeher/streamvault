const fs = require('fs');
const path = require('path');

const DEPLOY_ROOT = __dirname;
const REPO_ROOT = path.resolve(DEPLOY_ROOT, '..');
const PUBLIC_ROOT = path.join(REPO_ROOT, 'public');
const BOOT_SEARCH_VERSION = '20260624-playable-only-search1';

const STATIC_FILES = [
  'copyright.html',
  'disclaimer.html',
  'fallback.webp',
  'fifa-fast.js',
  'legal.css',
  'legal.html',
  'live-fast.js',
  'livetv.js',
  'privacy.html',
  'search.js',
  'terms.html'
];

function copyStaticFile(name) {
  const source = path.join(PUBLIC_ROOT, name);
  const destination = path.join(DEPLOY_ROOT, name);
  if (!fs.existsSync(source)) throw new Error(`Missing static source: public/${name}`);
  fs.copyFileSync(source, destination);
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchItem(item) {
  const name = item.name || item.title || '';
  const type = item.type || (item.seasons ? 'series' : 'movie');
  const searchText = normalizeSearchText([
    name,
    item.title,
    item.year,
    item.genre,
    item.category,
    item.file
  ].filter(Boolean).join(' '));
  return {
    ...item,
    name,
    title: item.title || name,
    type,
    searchText,
    searchTokens: [...new Set(searchText.split(' ').filter(token => token.length > 1))]
  };
}

function buildBootSearchIndex(homeFeed) {
  const candidates = [
    ...(Array.isArray(homeFeed.hero) ? homeFeed.hero : []),
    ...(Array.isArray(homeFeed.rows)
      ? homeFeed.rows.flatMap(row => Array.isArray(row.items) ? row.items : [])
      : [])
  ];
  const seen = new Set();
  const items = [];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'object') continue;
    const item = searchItem(raw);
    const key = [item.type, item.id || '', normalizeSearchText(item.name), item.year || ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return {
    ok: true,
    version: BOOT_SEARCH_VERSION,
    generatedAt: Date.parse(homeFeed.generatedAt) || 0,
    source: 'hostinger/home-feed.json',
    totalAvailable: items.length,
    total: items.length,
    tokenCount: items.reduce((count, item) => count + item.searchTokens.length, 0),
    items
  };
}

for (const name of STATIC_FILES) copyStaticFile(name);

const publicHomeFeed = path.join(PUBLIC_ROOT, 'home-feed.json');
if (!fs.existsSync(publicHomeFeed)) throw new Error('Missing static source: public/home-feed.json');
const homeFeed = JSON.parse(fs.readFileSync(publicHomeFeed, 'utf8'));
fs.copyFileSync(publicHomeFeed, path.join(DEPLOY_ROOT, 'home-feed.json'));
fs.writeFileSync(
  path.join(DEPLOY_ROOT, 'boot-search-index.json'),
  JSON.stringify(buildBootSearchIndex(homeFeed)) + '\n'
);

console.log(`Built Hostinger static data: ${STATIC_FILES.length + 2} files`);
