const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const {
  createSoftwarePostersMap,
  cleanTitle,
  normalizePosterName
} = require('./software-library');
const metadata = require('./software-metadata');

const SOFTWARE_SCHEMA_VERSION = 'software-vault-real-analysis-v10';

const STRICT_CATEGORIES = new Set([
  'Windows',
  'Android',
  'Console',
  'PC Games',
  'Emulators',
  'Utilities',
  'OS',
  'Archive',
  'Tutorials'
]);

const INSTALLER_EXTS = metadata.INSTALLER_EXTS;
const ARCHIVE_EXTS = metadata.ARCHIVE_EXTS;

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function hash(value, length = 18) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, length);
}

function safeDecode(value) {
  const text = String(value || '');
  try { return decodeURIComponent(text); } catch { return text; }
}

function flattenMeta(value, depth = 0) {
  if (value == null || value === false) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    return text && text !== '[object Object]' ? [text] : [];
  }
  if (depth > 2) return [];
  if (Array.isArray(value)) return value.flatMap(item => flattenMeta(item, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value).flatMap(item => flattenMeta(item, depth + 1));
  }
  return [];
}

function uniqueStrings(values, limit = 10) {
  const seen = new Set();
  const out = [];
  flattenMeta(values).forEach(value => {
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (!text || text === '[object Object]') return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out.slice(0, limit);
}

function normalizeSoftwareTitle(value) {
  return metadata.normalizeTitle(value || 'Untitled Software');
}

function normalizedKey(value) {
  return metadata.normalizedKey(value);
}

function filenameOf(item) {
  const direct = safeDecode(item?.filename || item?.name || '').trim();
  if (direct) return direct;
  try {
    return safeDecode(path.posix.basename(new URL(String(item?.url || item?.downloadUrl || '')).pathname));
  } catch {
    return safeDecode(path.posix.basename(String(item?.url || item?.downloadUrl || '').split(/[?#]/)[0]));
  }
}

function extOf(value) {
  return metadata.extensionOf(value);
}

function detectCategory(item) {
  return metadata.detectCategory(item, [metadata.normalizeFile(item, 0)].filter(Boolean));
}

function normalizePlatform(item, category) {
  return metadata.detectPlatform(item, category, [metadata.normalizeFile(item, 0)].filter(Boolean));
}

function normalizeHealthStatus(status, analysis = {}) {
  const text = uniqueStrings([status, analysis.badges, analysis.issues, analysis.warnings], 30).join(' ').toLowerCase();
  if (/missing archive|orphaned|broken|corrupt|incomplete|dead/.test(text)) return 'BROKEN/CORRUPT';
  if (/archive-only|archive only|no executable|no installer/.test(text) && !/installer\/launcher|executable file|standalone installer/.test(text)) return 'ARCHIVE ONLY';
  if (/good|verified|ok|installer\/launcher|executable file|standalone installer/.test(text)) return 'VERIFIED';
  return 'ARCHIVE ONLY';
}

function formatSize(size) {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function publicItem(pkg) {
  return {
    id: pkg.id,
    title: pkg.title,
    name: pkg.title,
    category: pkg.category,
    platform: pkg.platform,
    totalSize: pkg.totalSize || 0,
    totalSizeLabel: pkg.totalSizeLabel || formatSize(pkg.totalSize),
    fileCount: pkg.fileCount || 0,
    archiveParts: pkg.archiveParts || 0,
    partCount: pkg.archiveParts || 0,
    iconKind: pkg.category === 'PC Games' || pkg.category === 'Console' ? 'game' : 'file',
    health: pkg.health,
    fileHealth: pkg.health,
    updatedAt: pkg.updatedAt || '',
    tags: uniqueStrings(pkg.tags, 6),
    poster: pkg.poster || pkg.localPoster || '',
    posterUrl: pkg.posterUrl || '',
    localPoster: pkg.localPoster || '',
    generatedPosterPath: pkg.generatedPosterPath || '',
    posterSlug: pkg.posterSlug || normalizePosterName(pkg.title),
    posterFolder: pkg.posterFolder || (pkg.category === 'PC Games' ? 'games' : 'software')
  };
}

function detailItem(pkg) {
  return {
    ...publicItem(pkg),
    description: metadata.descriptionFor(pkg),
    analysis: pkg.analysis || metadata.analyzeFiles(pkg.files || []),
    fileHealth: pkg.fileHealth || pkg.health,
    files: Array.isArray(pkg.files) ? pkg.files : [],
    archiveParts: Array.isArray(pkg.files) ? pkg.files : [],
    downloadMirrors: Array.isArray(pkg.files) ? pkg.files : [],
    installGuide: Array.isArray(pkg.installGuide) ? pkg.installGuide : [],
    relatedTitles: Array.isArray(pkg.relatedTitles) ? pkg.relatedTitles : [],
    screenshots: Array.isArray(pkg.screenshots) ? pkg.screenshots : [],
    manifestUrl: ''
  };
}

function extractPackages(raw) {
  if (Array.isArray(raw?.packages)) return raw.packages;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.downloads)) return raw.downloads;
  if (Array.isArray(raw)) return raw;
  return [];
}

function packageFromRaw(raw, posters) {
  const titleSource = raw.title || raw.name || raw.filename || filenameOf(raw);
  const title = normalizeSoftwareTitle(titleSource);
  const files = Array.isArray(raw.files) && raw.files.length ? raw.files : [raw];
  const cleanFiles = files.map((file, index) => {
    const filename = filenameOf(file);
    const url = file.downloadUrl || file.url || raw.downloadUrl || raw.url || '';
    const id = String(file.id || `sf_${hash(`${url}|${filename}|${index}`)}`);
    const normalized = metadata.normalizeFile({ ...file, downloadUrl: url, url, id }, index, raw);
    if (!normalized) return null;
    return {
      ...normalized,
      id,
      sizeLabel: file.sizeLabel || formatSize(normalized.size),
      directUrl: url
    };
  }).filter(file => file && file.downloadUrl);
  const category = STRICT_CATEGORIES.has(raw.category) ? raw.category : metadata.detectCategory(raw, cleanFiles);
  const platform = normalizePlatform(raw, category);
  const totalSize = Number(raw.totalSize || raw.size || cleanFiles.reduce((sum, file) => sum + (Number(file.size) || 0), 0)) || 0;
  const analysis = metadata.analyzeFiles(cleanFiles);
  const healthStatus = normalizeHealthStatus(analysis.status, analysis);
  const health = { status: healthStatus, badges: analysis.badges, issues: analysis.issues, warnings: analysis.warnings };
  const folder = category === 'PC Games' || category === 'Console' ? 'games' : 'software';
  const posterSlug = normalizePosterName(title);
  const localPoster = posters.byFolder?.[folder]?.[posterSlug] || posters.byFolder?.games?.[posterSlug] || posters.byFolder?.software?.[posterSlug] || '';
  const tags = uniqueStrings([category, platform, healthStatus, raw.tags], 8)
    .filter(tag => tag !== title)
    .filter(tag => {
      const key = String(tag).toLowerCase();
      if (['good', 'warning', 'bad', 'verified', 'archive only', 'broken/corrupt'].includes(key)) return tag === healthStatus;
      return true;
    })
    .slice(0, 6);
  const searchText = uniqueStrings([title, category, platform, healthStatus, tags, cleanFiles.map(file => file.filename)], 80).join(' ').toLowerCase();

  return {
    id: String(raw.id || `sw_${hash(`${title}|${platform}|${cleanFiles[0]?.downloadUrl || ''}`)}`),
    title,
    category,
    platform,
    totalSize,
    totalSizeLabel: raw.totalSizeLabel || formatSize(totalSize),
    fileCount: cleanFiles.length,
    archiveParts: cleanFiles.filter(file => ARCHIVE_EXTS.has(file.extension) || file.partNumber > 0).length,
    partCount: cleanFiles.filter(file => ARCHIVE_EXTS.has(file.extension) || file.partNumber > 0).length,
    health,
    fileHealth: health,
    analysis,
    updatedAt: raw.updatedAt || raw.addedAt || raw.uploadDate || '',
    tags,
    files: cleanFiles,
    installGuide: metadata.installGuideFor({ title, category, platform, files: cleanFiles, analysis }),
    relatedTitles: [],
    screenshots: Array.isArray(raw.screenshots) ? raw.screenshots.filter(Boolean).slice(0, 12) : [],
    description: metadata.descriptionFor({ title, category, platform, fileCount: cleanFiles.length, description: raw.description || raw.overview }),
    poster: raw.poster || raw.localPoster || localPoster || '',
    posterUrl: raw.posterUrl || '',
    localPoster,
    generatedPosterPath: posterSlug ? `/posters/${folder}/${posterSlug}.webp` : '',
    posterSlug,
    posterFolder: folder,
    searchText,
    qualityScore: (healthStatus === 'GOOD' ? 1000 : healthStatus === 'WARNING' ? 500 : 0) +
      (localPoster ? 100 : 0) + Math.min(cleanFiles.length, 50) + Math.min(Math.floor(totalSize / 1073741824), 50)
  };
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function done(err) {
    if (err) reject(err);
    else resolve(this);
  }));
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
}

function stmtRun(stmt, params = []) {
  return new Promise((resolve, reject) => stmt.run(params, err => err ? reject(err) : resolve()));
}

function stmtFinalize(stmt) {
  return new Promise((resolve, reject) => stmt.finalize(err => err ? reject(err) : resolve()));
}

async function bulkInsertSoftware(db, packages) {
  await run(db, 'BEGIN IMMEDIATE');
  let itemStmt = null;
  let fileStmt = null;
  try {
    await run(db, 'DELETE FROM software_files');
    await run(db, 'DELETE FROM software_items');
    itemStmt = db.prepare(`INSERT OR REPLACE INTO software_items
      (id, dedupe_key, title, platform, category, health_status, search_text, total_size, updated_at, quality_score, public_json, detail_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    fileStmt = db.prepare('INSERT OR REPLACE INTO software_files (id, item_id, download_url, json) VALUES (?, ?, ?, ?)');
    for (const item of packages) {
      const pub = publicItem(item);
      const detail = detailItem(item);
      await stmtRun(itemStmt, [
        item.id,
        `${normalizedKey(item.title)}|${item.platform.toLowerCase()}`,
        item.title,
        item.platform,
        item.category,
        item.health.status,
        item.searchText,
        item.totalSize,
        item.updatedAt,
        item.qualityScore,
        JSON.stringify(pub),
        JSON.stringify(detail)
      ]);
      for (const file of item.files) {
        await stmtRun(fileStmt, [
          file.id,
          item.id,
          file.downloadUrl,
          JSON.stringify({ ...file, packageId: item.id, packageTitle: item.title })
        ]);
      }
    }
    await stmtFinalize(itemStmt);
    itemStmt = null;
    await stmtFinalize(fileStmt);
    fileStmt = null;
    await run(db, 'INSERT OR REPLACE INTO software_meta (key, value) VALUES (?, ?)', ['schema_version', SOFTWARE_SCHEMA_VERSION]);
    await run(db, 'INSERT OR REPLACE INTO software_meta (key, value) VALUES (?, ?)', ['rebuilt_at', new Date().toISOString()]);
    await run(db, 'COMMIT');
  } catch (err) {
    if (itemStmt) await stmtFinalize(itemStmt).catch(() => {});
    if (fileStmt) await stmtFinalize(fileStmt).catch(() => {});
    await run(db, 'ROLLBACK').catch(() => {});
    throw err;
  }
}

function createSoftwareDb(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const dbFile = options.dbFile || path.join(rootDir, 'data', 'db', 'streamvault-main.db');
  const libraryFile = options.libraryFile || path.join(rootDir, 'data', 'catalogs', 'software-library.json');
  const fallbackInputFile = options.fallbackInputFile || path.join(rootDir, 'data', 'catalogs', 'downloads-catalog.json');
  const db = new sqlite3.Database(dbFile);
  db.configure('busyTimeout', 10000);
  const posters = createSoftwarePostersMap(rootDir);
  let initPromise = null;

  async function createSchema() {
    await run(db, `CREATE TABLE IF NOT EXISTS software_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    await run(db, `CREATE TABLE IF NOT EXISTS software_items (
      id TEXT PRIMARY KEY,
      dedupe_key TEXT UNIQUE,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      category TEXT NOT NULL,
      health_status TEXT NOT NULL,
      search_text TEXT NOT NULL,
      total_size INTEGER DEFAULT 0,
      updated_at TEXT,
      quality_score INTEGER DEFAULT 0,
      public_json TEXT NOT NULL,
      detail_json TEXT NOT NULL
    )`);
    await run(db, `CREATE TABLE IF NOT EXISTS software_files (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      download_url TEXT NOT NULL,
      json TEXT NOT NULL
    )`);
    await run(db, 'CREATE INDEX IF NOT EXISTS idx_software_title ON software_items(title)');
    await run(db, 'CREATE INDEX IF NOT EXISTS idx_software_search ON software_items(search_text)');
    await run(db, 'CREATE INDEX IF NOT EXISTS idx_software_category ON software_items(category)');
    await run(db, 'CREATE INDEX IF NOT EXISTS idx_software_platform ON software_items(platform)');
    await run(db, 'CREATE INDEX IF NOT EXISTS idx_software_files_item ON software_files(item_id)');
  }

  async function seedIfNeeded() {
    const row = await get(db, 'SELECT COUNT(*) AS count FROM software_items');
    const version = await get(db, 'SELECT value FROM software_meta WHERE key = ?', ['schema_version']).catch(() => null);
    const legacy = await get(db, "SELECT COUNT(*) AS count FROM software_items WHERE health_status IN ('GOOD','WARNING','BAD')").catch(() => ({ count: 0 }));
    const existingCount = Number(row?.count || 0);
    const start = nowMs();
    const sourceFiles = [libraryFile, fallbackInputFile].filter(file => fs.existsSync(file));
    const sources = sourceFiles.map(file => {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      const items = extractPackages(raw);
      return { file, items, preferred: file === libraryFile && Array.isArray(raw?.packages) };
    });
    const preferred = sources.find(source => source.preferred);
    const fallback = sources.find(source => !source.preferred);
    const best = preferred || fallback;
    if (!best) return;
    const selectedItems = preferred ? [...preferred.items, ...(fallback?.items || [])] : best.items;
    if (existingCount > 0 && version?.value === SOFTWARE_SCHEMA_VERSION && Number(legacy?.count || 0) === 0) return;
    if (existingCount > 0) {
      console.log('[StreamVault software-db] refreshing software table', { existing: existingCount, sourceItems: selectedItems.length, version: version?.value || 'none' });
      await run(db, 'DELETE FROM software_files');
      await run(db, 'DELETE FROM software_items');
    }
    const candidates = selectedItems.map(item => packageFromRaw(item, posters)).filter(item => item.files.length);
    const deduped = new Map();
    candidates.forEach(item => {
      const key = `${normalizedKey(item.title)}|${item.platform.toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing || item.qualityScore > existing.qualityScore) deduped.set(key, item);
    });
    const packages = Array.from(deduped.values());
    const relatedBuckets = new Map();
    packages.forEach(item => {
      if (!relatedBuckets.has(item.category)) relatedBuckets.set(item.category, []);
      relatedBuckets.get(item.category).push(item);
    });
    packages.forEach(item => {
      item.relatedTitles = (relatedBuckets.get(item.category) || [])
        .filter(other => other.id !== item.id && other.platform === item.platform)
        .slice(0, 12)
        .map(publicItem);
    });
    await bulkInsertSoftware(db, packages);
    console.log('[StreamVault software-db] duplicate removal counts', {
      input: candidates.length,
      removed: candidates.length - packages.length,
      kept: packages.length
    });
    console.log('[StreamVault software-db] SQL load timing', { ms: nowMs() - start, source: preferred && fallback ? `${path.basename(preferred.file)}+${path.basename(fallback.file)}` : path.basename(best.file) });
  }

  async function init() {
    if (!initPromise) {
      initPromise = (async () => {
        const start = nowMs();
        await createSchema();
        await seedIfNeeded();
        const count = await get(db, 'SELECT COUNT(*) AS count FROM software_items');
        console.log('[StreamVault software-db] SQL ready', { total: Number(count?.count || 0), ms: nowMs() - start });
      })();
    }
    return initPromise;
  }

  function filterSql(filter) {
    const key = String(filter || 'All').toLowerCase();
    if (!key || key === 'all') return { sql: '', params: [] };
    if (key === 'games') return { sql: 'AND category = ?', params: ['PC Games'] };
    if (key === 'archives') return { sql: 'AND category = ?', params: ['Archive'] };
    if (key === 'verified') return { sql: 'AND health_status = ?', params: ['VERIFIED'] };
    const title = key === 'pc games' ? 'PC Games' : key.replace(/\b\w/g, c => c.toUpperCase());
    if (STRICT_CATEGORIES.has(title)) return { sql: 'AND category = ?', params: [title] };
    return { sql: '', params: [] };
  }

  function querySql(q) {
    const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
    return {
      sql: terms.map(() => 'AND search_text LIKE ?').join(' '),
      params: terms.map(term => `%${term}%`)
    };
  }

  return {
    ready: init,
    async query(options = {}) {
      await init();
      const start = nowMs();
      const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
      const limit = Math.max(1, Math.min(120, Number.parseInt(options.limit, 10) || 40));
      const offset = (page - 1) * limit;
      const filter = filterSql(options.filter);
      const search = querySql(options.q);
      const where = `WHERE 1=1 ${filter.sql} ${search.sql}`;
      const params = [...filter.params, ...search.params];
      const totalRow = await get(db, `SELECT COUNT(*) AS total FROM software_items ${where}`, params);
      const rows = await all(db, `SELECT public_json FROM software_items ${where} ORDER BY title COLLATE NOCASE LIMIT ? OFFSET ?`, [...params, limit, offset]);
      const items = rows.map(row => JSON.parse(row.public_json));
      console.log('[StreamVault software-db] pagination timing', { page, limit, returned: items.length, total: Number(totalRow?.total || 0), ms: nowMs() - start });
      return {
        items,
        total: Number(totalRow?.total || 0),
        page,
        limit,
        pages: Math.ceil((Number(totalRow?.total || 0)) / limit)
      };
    },
    async detail(id) {
      await init();
      const row = await get(db, 'SELECT detail_json FROM software_items WHERE id = ?', [String(id || '')]);
      return row ? JSON.parse(row.detail_json) : null;
    },
    async getFile(id) {
      await init();
      const row = await get(db, 'SELECT json FROM software_files WHERE id = ?', [String(id || '')]);
      return row ? JSON.parse(row.json) : null;
    },
    postersMap() {
      return {
        generatedAt: posters.generatedAt,
        total: posters.total,
        stats: { available: posters.total },
        map: posters.map
      };
    }
  };
}

module.exports = {
  createSoftwareDb,
  normalizeSoftwareTitle,
  flattenMeta
};
