#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  createSoftwarePostersMap,
  normalizePosterName
} = require('../lib/software-library');

const rootDir = path.join(__dirname, '..');
const catalogFile = path.resolve(process.argv[2] || path.join(rootDir, 'data', 'catalogs', 'software-library.json'));

function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return fallback;
}

const catalog = loadJSON(catalogFile, { packages: [] });
const packages = Array.isArray(catalog.packages) ? catalog.packages : [];
const posters = createSoftwarePostersMap(rootDir);

let matched = 0;
let missing = 0;
const missingSamples = [];

for (const item of packages) {
  const folder = String(item.posterFolder || '').trim()
    || (/game/i.test(`${item.category || ''} ${item.platform || ''}`) ? 'games' : 'software');
  const slug = String(normalizePosterName(item.title || item.name || '')).toLowerCase();
  const hit = posters.map[`${folder}:${slug}`] || posters.map[`games:${slug}`] || posters.map[`software:${slug}`];
  if (hit) matched += 1;
  else {
    missing += 1;
    if (missingSamples.length < 25) missingSamples.push({ title: item.title || item.name, expected: `/posters/${folder}/${slug}.webp` });
  }
}

console.log(`Software titles: ${packages.length}`);
console.log(`Available poster files: ${posters.total}`);
console.log(`Matched posters: ${matched}`);
console.log(`Missing posters: ${missing}`);
if (missingSamples.length) {
  console.log('Missing samples:');
  missingSamples.forEach(sample => console.log(`- ${sample.title} -> ${sample.expected}`));
}
