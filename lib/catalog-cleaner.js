const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeTitle, cleanDisplayTitle, extractYear, normalizedKey, isReleaseJunk } = require('./normalize-title');
const { validateMediaItem } = require('./media-validator');
const { dedupeCatalog, mergeSources, selectBestSource, sourceForItem, sourceHost } = require('./catalog-dedupe');
const { validTmdbImage, searchTmdb } = require('./tmdb-verify');
const { buildHomeSections } = require('./home-sections');
const { rejectMedia } = require('./rejected-media');

const APPROVED_SCHEMA_VERSION = 4;

function hash(value, length = 14) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, length);
}

function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return fallback;
}

function writeJSONAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function posterOk(item) {
  return validTmdbImage(item.poster) || validTmdbImage(item.backdrop);
}

function bestPoster(item) {
  return validTmdbImage(item.poster) ? item.poster : (validTmdbImage(item.backdrop) ? item.backdrop : '');
}

function bestBackdrop(item) {
  return validTmdbImage(item.backdrop) ? item.backdrop : (validTmdbImage(item.poster) ? item.poster : '');
}

function playableUrl(item = {}) {
  if (item.streamUrl || item.url) return String(item.streamUrl || item.url);
  const first = Array.isArray(item.sources) ? item.sources.find(source => source?.url) : null;
  return first ? String(first.url) : '';
}

function filenameFromUrl(url = '') {
  try {
    const parsed = new URL(String(url || ''));
    return decodeURIComponent(path.posix.basename(parsed.pathname || ''));
  } catch {
    return String(url || '').split(/[\\/]/).pop() || '';
  }
}

function rawTitleFor(raw = {}) {
  const streamUrl = playableUrl(raw);
  return raw.normalizedTitle || raw.tmdbTitle || raw.title || raw.name || raw.filename || raw.file || filenameFromUrl(streamUrl) || streamUrl || '';
}

function extractedCatalogYear(raw = {}, validation = {}) {
  const streamUrl = playableUrl(raw);
  const filename = raw.filename || raw.file || filenameFromUrl(streamUrl);
  return String(
    extractYear(`${filename || ''} ${streamUrl || ''}`) ||
    extractYear(raw.title || raw.name || '') ||
    validation.year ||
    raw.year ||
    ''
  ).slice(0, 4);
}

function numericTmdbId(value) {
  const text = String(value || '').trim();
  return /^\d+$/.test(text) ? text : '';
}

function splitGenreNames(item = {}) {
  const values = [
    item.genre,
    ...(Array.isArray(item.genres) ? item.genres.map(g => typeof g === 'string' ? g : g?.name) : [])
  ];
  return values
    .filter(Boolean)
    .join(',')
    .split(/[,/|]/)
    .map(g => g.trim())
    .filter(Boolean);
}

function cacheMetadataFor(raw, posterCache = {}, type = 'movie') {
  const title = normalizeTitle(rawTitleFor(raw));
  const keys = [
    raw.filename ? path.basename(raw.filename, path.extname(raw.filename)) : '',
    raw.title || raw.name || '',
    title,
    type === 'series' ? `__series__${title}` : ''
  ].filter(Boolean);
  for (const key of keys) {
    if (posterCache[key]) return posterCache[key];
  }
  return {};
}

function baseSearchText(item) {
  return [
    item.displayTitle,
    item.normalizedTitle,
    item.tmdbTitle,
    ...(Array.isArray(item.aliases) ? item.aliases : []),
    item.genre,
    ...(Array.isArray(item.genres) ? item.genres.map(g => typeof g === 'string' ? g : g.name) : []),
    ...(Array.isArray(item.actors) ? item.actors : []),
    ...(Array.isArray(item.cast) ? item.cast.map(c => typeof c === 'string' ? c : c.name) : []),
    ...(Array.isArray(item.productionCompanies) ? item.productionCompanies.map(c => typeof c === 'string' ? c : c.name) : [])
  ].filter(Boolean).join(' ');
}

function stableTmdbBackedId(item) {
  if (item.tmdbId) return item.tmdbId;
  const art = bestPoster(item) || bestBackdrop(item);
  return art ? `tmdbimg_${hash(`${item.normalizedTitle}|${item.year}|${art}`, 16)}` : '';
}

function cleanOne(raw, options = {}) {
  const type = options.type || raw.type || 'movie';
  const meta = cacheMetadataFor(raw, options.posterCache, type);
  const merged = { ...raw, ...meta };
  const streamUrl = playableUrl(merged);
  const filename = merged.filename || merged.file || filenameFromUrl(streamUrl);
  const validation = validateMediaItem({ ...merged, filename, streamUrl }, { kind: type === 'series' ? 'series' : 'movie', allowFolders: type === 'series' });
  if (!validation.ok && type !== 'series') return null;
  const normalizedTitle = normalizeTitle(rawTitleFor({ ...merged, filename, streamUrl }));
  const year = extractedCatalogYear({ ...merged, filename, streamUrl }, validation);
  if (!normalizedTitle || normalizedTitle.length < 3 || /^\d+$/.test(normalizedTitle) || isReleaseJunk(normalizedTitle)) {
    rejectMedia('invalid approved title', merged, { normalizedTitle, year });
    return null;
  }

  const sources = mergeSources(merged.sources || [], sourceForItem({ ...merged, filename, streamUrl }));
  const bestSource = selectBestSource(sources);
  const tmdbId = merged.tmdbId || merged.tmdb_id || null;
  const numericId = numericTmdbId(tmdbId);

  const seasons = toArray(merged.seasons);
  const episodeCount = seasons.reduce((sum, season) => sum + toArray(season.episodes).length, 0);
  const clean = {
    id: merged.id || `${type}_${hash(numericId || `${normalizedTitle}|${year}|${bestSource?.url || streamUrl}`)}`,
    name: normalizedTitle,
    title: normalizedTitle,
    displayTitle: cleanDisplayTitle(merged.displayTitle || merged.tmdbTitle || merged.title || merged.name || normalizedTitle),
    normalizedTitle,
    normalizedKey: normalizedKey(`${normalizedTitle} ${year}`),
    tmdbTitle: normalizeTitle(merged.tmdbTitle || merged.originalTitle || merged.title || normalizedTitle),
    tmdbId,
    year,
    poster: bestPoster(merged),
    backdrop: bestBackdrop(merged),
    overview: merged.overview || '',
    rating: merged.voteAverage || merged.vote_average || merged.rating || 0,
    voteAverage: merged.voteAverage || merged.vote_average || merged.rating || 0,
    popularity: merged.popularity || merged.trendingScore || 0,
    genre: merged.genre || '',
    genres: merged.genres || [],
    genreIds: merged.genreIds || merged.genre_ids || [],
    originalLanguage: merged.originalLanguage || merged.languageCode || merged.original_language || '',
    languageCode: merged.languageCode || merged.originalLanguage || merged.original_language || '',
    originCountry: merged.originCountry || merged.origin_country || [],
    productionCompanies: merged.productionCompanies || merged.production_companies || [],
    networks: merged.networks || [],
    actors: merged.actors || [],
    aliases: merged.aliases || [],
    type: type === 'series' ? 'tv' : 'movie',
    streamUrl: bestSource?.url || streamUrl || '',
    sources,
    isFtp: !!(bestSource?.url || streamUrl || merged.server),
    seasons: type === 'series' ? seasons : undefined,
    seasonCount: type === 'series' ? seasons.length : 0,
    episodeCount: type === 'series' ? episodeCount : 0,
    source: bestSource?.source || merged.source || merged.server || '',
    sourceHost: bestSource?.host || sourceHost(streamUrl || merged.server || ''),
    responseSpeed: bestSource?.responseSpeed ?? merged.responseSpeed ?? null,
    lastVerified: bestSource?.lastVerified || merged.lastVerified || merged.verifiedAt || merged.checkedAt || null,
    addedAt: merged.addedAt || merged.discoveredAt || merged.updatedAt || '',
    metadataSource: numericId ? 'tmdb-id' : (posterOk(merged) ? 'catalog-art' : 'pending-tmdb')
  };

  clean.genres = Array.isArray(clean.genres) && clean.genres.length ? clean.genres : splitGenreNames(clean);
  clean.approvedForHome = !!(posterOk(clean) && (clean.streamUrl || type === 'series') && (type !== 'series' || episodeCount > 0));
  clean.approvedForSearch = clean.approvedForHome;
  clean.searchText = normalizedKey(baseSearchText(clean));
  if (!clean.approvedForHome && !clean.approvedForSearch) {
    rejectMedia('not approved for home or search', merged, { normalizedTitle, year });
  }
  return clean;
}

function toFinalMovie(item = {}) {
  return {
    id: item.id,
    title: item.title || item.name,
    name: item.name || item.title,
    displayTitle: item.displayTitle || cleanDisplayTitle(item.title || item.name),
    year: item.year || '',
    tmdbId: item.tmdbId || null,
    overview: item.overview || '',
    poster: item.poster || null,
    backdrop: item.backdrop || item.poster || null,
    genres: item.genres || splitGenreNames(item),
    genre: item.genre || '',
    rating: item.rating || item.voteAverage || 0,
    voteAverage: item.voteAverage || item.rating || 0,
    runtime: item.runtime || '',
    language: item.language || '',
    productionCompanies: item.productionCompanies || [],
    type: item.type || 'movie',
    streamUrl: item.streamUrl || '',
    isFtp: !!item.streamUrl,
    sources: mergeSources(item.sources || [], sourceForItem(item)),
    source: item.source || item.sourceName || '',
    sourceHost: item.sourceHost || sourceHost(item.streamUrl || ''),
    responseSpeed: item.responseSpeed ?? null,
    lastVerified: item.lastVerified || null,
    approvedForHome: !!item.approvedForHome,
    approvedForSearch: !!item.approvedForSearch,
    searchText: item.searchText || normalizedKey(baseSearchText(item))
  };
}

function finalizeCleanCatalog(data) {
  data.movies = dedupeCatalog(data.movies || [], { kind: 'movie', allowMetadataOnly: true });
  data.series = dedupeCatalog(data.series || [], { kind: 'series', allowMetadataOnly: true });
  data.home = {
    movies: data.movies.filter(item => item.approvedForHome),
    series: data.series.filter(item => item.approvedForHome)
  };
  data.home.sections = buildHomeSections({ movies: data.home.movies, series: data.home.series });
  data.finalMovies = data.movies.filter(item => item.approvedForSearch).map(toFinalMovie);
  data.stats = {
    movies: data.movies.length,
    series: data.series.length,
    homeMovies: data.home.movies.length,
    homeSeries: data.home.series.length,
    finalMovies: data.finalMovies.length
  };
  return data;
}

function cleanCatalog(rawCatalog = {}, options = {}) {
  const posterCache = options.posterCache || {};
  const data = {
    schemaVersion: APPROVED_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: rawCatalog.source || 'merged-catalog',
    movies: toArray(rawCatalog.movies).map(item => cleanOne(item, { posterCache, type: 'movie' })).filter(Boolean),
    series: toArray(rawCatalog.series).map(item => cleanOne(item, { posterCache, type: 'series' })).filter(Boolean)
  };
  return finalizeCleanCatalog(data);
}

function createCatalogCleaner(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const approvedFile = options.approvedFile || path.join(rootDir, 'data', 'catalogs', 'approved-clean-catalog.json');
  const token = options.tmdbToken || '';
  let memory = null;
  let refreshing = false;

  function loadApproved() {
    if (memory) return memory;
    memory = loadJSON(approvedFile, null);
    return memory;
  }

  function snapshot(rawCatalog = {}, posterCache = {}) {
    const existing = loadApproved();
    if (existing?.schemaVersion === APPROVED_SCHEMA_VERSION && existing?.home?.sections) return existing;
    memory = cleanCatalog(rawCatalog, { posterCache });
    writeJSONAtomic(approvedFile, memory);
    return memory;
  }

  function refresh(rawCatalog = {}, posterCache = {}) {
    memory = cleanCatalog(rawCatalog, { posterCache });
    writeJSONAtomic(approvedFile, memory);
    return memory;
  }

  async function enrichMissing(items = [], limit = 80) {
    if (!token) return [];
    const out = [];
    for (const item of items.filter(i => !String(i.tmdbId || '').match(/^\d+$/)).slice(0, limit)) {
      try {
        const match = await searchTmdb({ title: item.normalizedTitle || item.title, year: item.year, type: item.type, token });
        if (match?.tmdbId) {
          out.push({
            ...item,
            ...match,
            tmdbId: match.tmdbId,
            sources: item.sources || [],
            streamUrl: item.streamUrl || '',
            approvedForHome: !!(match.poster || match.backdrop),
            approvedForSearch: !!(match.poster || match.backdrop),
            metadataSource: 'tmdb-search'
          });
        } else {
          rejectMedia('failed TMDB match: low confidence or missing', item, { normalizedTitle: item.normalizedTitle || item.title, year: item.year });
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    return out;
  }

  function refreshAsync(rawCatalog = {}, posterCache = {}) {
    if (refreshing) return;
    refreshing = true;
    setImmediate(async () => {
      try {
        const next = cleanCatalog(rawCatalog, { posterCache });
        const enrichmentCandidates = [...next.movies, ...next.series]
          .filter(item => item.streamUrl || item.approvedForHome)
          .sort((a, b) => Number(!!b.poster) - Number(!!a.poster));
        const enriched = await enrichMissing(enrichmentCandidates, options.enrichLimit || 0);
        if (enriched.length) {
          const byId = new Map([...next.movies, ...next.series].map(item => [item.id, item]));
          enriched.forEach(item => byId.set(item.id, item));
          next.movies = Array.from(byId.values()).filter(item => item.type !== 'tv');
          next.series = Array.from(byId.values()).filter(item => item.type === 'tv');
          finalizeCleanCatalog(next);
        }
        next.generatedAt = new Date().toISOString();
        memory = next;
        writeJSONAtomic(approvedFile, next);
      } catch (err) {
        console.warn('[CatalogCleaner] refresh failed:', err.message);
      } finally {
        refreshing = false;
      }
    });
  }

  function search(query = '', opts = {}) {
    const data = loadApproved();
    const q = normalizedKey(query);
    if (!data || !q) return { items: [], total: 0, page: 1, limit: opts.limit || 48, pages: 0 };
    const terms = q.split(/\s+/).filter(Boolean);
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(80, Math.max(1, Number(opts.limit) || 48));
    const all = [...toArray(data.movies), ...toArray(data.series)].filter(item => item.approvedForSearch || item.approvedForHome);
    const items = all.filter(item => {
      const text = item.searchText || normalizedKey(baseSearchText(item));
      return terms.every(term => text.includes(term));
    });
    const start = (page - 1) * limit;
    return { items: items.slice(start, start + limit), total: items.length, page, limit, pages: Math.ceil(items.length / limit) };
  }

  return { loadApproved, snapshot, refresh, refreshAsync, search, approvedFile };
}

module.exports = {
  createCatalogCleaner,
  cleanCatalog,
  cleanOne
};
