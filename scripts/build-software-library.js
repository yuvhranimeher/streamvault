#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { buildSoftwareLibrary, applySoftwarePosters } = require('../lib/software-library');

const rootDir = path.join(__dirname, '..');
const catalogsDir = path.join(rootDir, 'data', 'catalogs');
const requestedInput = path.resolve(process.argv[2] || path.join(catalogsDir, 'software-catalog.json'));
const outputFile = path.resolve(process.argv[3] || path.join(catalogsDir, 'software-library.json'));

function loadJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function catalogCount(file) {
  try {
    const raw = loadJSON(file, {});
    if (Array.isArray(raw)) return raw.length;
    return (raw.downloads || raw.items || raw.files || []).length || 0;
  } catch {
    return 0;
  }
}

const fallbackInput = path.join(catalogsDir, 'downloads-catalog.json');
const inputFile = catalogCount(requestedInput) ? requestedInput : fallbackInput;

try {
  const existing = loadJSON(outputFile, null);
  const existingPackages = Array.isArray(existing?.packages) ? existing.packages.length : 0;
  const result = !catalogCount(requestedInput) && existingPackages
    ? applySoftwarePosters(existing, rootDir).library
    : buildSoftwareLibrary(inputFile, outputFile, { rootDir });
  if (!catalogCount(requestedInput) && existingPackages) {
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');
  }
  console.log(`Software library rebuilt: ${result.total} titles, ${result.files} files`);
  console.log(`Matched posters: ${result.posterStats?.matched || 0}`);
  console.log(`Missing posters: ${result.posterStats?.missing || 0}`);
  console.log(`Input: ${inputFile}`);
  console.log(`Output: ${outputFile}`);
} catch (error) {
  console.error(`Software library rebuild failed: ${error.message}`);
  process.exitCode = 1;
}
