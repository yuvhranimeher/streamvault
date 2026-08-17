'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_CATALOG = path.join(__dirname, 'catalog.json');
const SCAN_DIR = path.join(__dirname, 'scan-output');
const MASSIVE_CATALOG = path.join(SCAN_DIR, 'clean-catalog.json');

function needsSync(source, target) {
  if (!fs.existsSync(source)) return false;
  if (!fs.existsSync(target)) return true;
  try {
    const src = fs.statSync(source);
    const dst = fs.statSync(target);
    return src.size !== dst.size || src.mtimeMs > dst.mtimeMs + 1000;
  } catch {
    return true;
  }
}

function ensureMassiveCatalog() {
  if (!fs.existsSync(ROOT_CATALOG)) {
    console.warn('[StreamVault] catalog.json is missing; massive catalog search cannot be prepared.');
    return;
  }

  fs.mkdirSync(SCAN_DIR, { recursive: true });

  if (!needsSync(ROOT_CATALOG, MASSIVE_CATALOG)) {
    console.log('[StreamVault] massive catalog is already ready.');
    return;
  }

  const source = fs.statSync(ROOT_CATALOG);
  console.log(`[StreamVault] preparing massive search catalog (${(source.size / 1024 / 1024).toFixed(1)} MB)...`);
  fs.copyFileSync(ROOT_CATALOG, MASSIVE_CATALOG);
  console.log('[StreamVault] massive search catalog ready:', MASSIVE_CATALOG);
}

try {
  ensureMassiveCatalog();
} catch (error) {
  console.error('[StreamVault] failed to prepare massive catalog:', error?.stack || error);
}

require('./server');
