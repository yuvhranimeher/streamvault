const path = require('path');
const { normalizeTitle, extractYear, normalizedKey } = require('./normalize-title');
const { validateMediaItem } = require('./media-validator');
const { rejectMedia } = require('./rejected-media');

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

function filenameOf(item = {}) {
  return String(item.filename || item.file || filenameFromUrl(playableUrl(item)) || item.title || item.name || '');
}

function sourceHost(url = '') {
  try {
    return new URL(String(url || '')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function sourceName(item = {}, url = '') {
  const explicit = item._sourceName || item.sourceName || item.catalogSource || item.provider;
  if (explicit) return String(explicit).trim().toLowerCase();
  const raw = String(item.source || '').trim();
  if (raw && !/^https?:\/\//i.test(raw) && !/^ftp:\/\//i.test(raw)) return raw.toLowerCase();
  const host = sourceHost(url || raw);
  return host || 'main';
}

function sourceResponseSpeed(item = {}) {
  const value = item.responseSpeed ?? item.responseMs ?? item.responseTime ?? item.latency ?? item.speed ?? item.health?.latency;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function sourceLastVerified(item = {}) {
  return item.lastVerified || item.verifiedAt || item.checkedAt || item.health?.checkedAt || item.updatedAt || item.discoveredAt || item.addedAt || null;
}

function sourceForItem(item = {}) {
  const url = playableUrl(item);
  if (!url) return null;
  return {
    source: sourceName(item, url),
    url,
    host: sourceHost(url),
    responseSpeed: sourceResponseSpeed(item),
    lastVerified: sourceLastVerified(item)
  };
}

function normalizeSource(source = {}, fallback = {}) {
  if (!source) {
  return null;
}
  const url = String(source.url || source.streamUrl || source.href || fallback.url || '').trim();
  if (!url) return null;
  return {
    source: String(source.source || source.name || fallback.source || sourceName(fallback, url) || 'main').trim().toLowerCase(),
    url,
    host: String(source.host || sourceHost(url) || '').toLowerCase(),
    responseSpeed: sourceResponseSpeed(source) ?? sourceResponseSpeed(fallback),
    lastVerified: source.lastVerified || source.verifiedAt || source.checkedAt || sourceLastVerified(fallback)
  };
}

function sourceRank(source = {}) {
  let score = 0;
  const src = String(source.source || '').toLowerCase();
  const host = String(source.host || '').toLowerCase();
  if (src === 'main') score += 30;
  if (src === 'bloggerbd') score += 12;
  if (/^(172\.|10\.|192\.168\.)/.test(host)) score += 8;
  const speed = Number(source.responseSpeed);
  if (Number.isFinite(speed) && speed > 0) score += Math.max(0, 20 - Math.min(speed, 5000) / 250);
  return score;
}

function sourceKey(source = {}) {
  try {
    return new URL(source.url).href;
  } catch {
    return String(source.url || '').trim();
  }
}

function mergeSources(...groups) {
  const byUrl = new Map();
  for (const group of groups) {
    const list = Array.isArray(group) ? group : [group];
    for (const raw of list) {
      const source = normalizeSource(raw);
      if (!source) continue;
      const key = sourceKey(source);
      const existing = byUrl.get(key);
      if (!existing || sourceRank(source) > sourceRank(existing)) byUrl.set(key, source);
      else if (!existing.lastVerified && source.lastVerified) existing.lastVerified = source.lastVerified;
    }
  }
  return Array.from(byUrl.values()).sort((a, b) => sourceRank(b) - sourceRank(a));
}

function selectBestSource(sources = []) {
  return mergeSources(sources)[0] || null;
}

function qualityScore(item = {}) {
  const text = [item.filename, item.file, item.title, item.name, item.streamUrl, playableUrl(item)].filter(Boolean).join(' ').toLowerCase();
  let score = 0;
  if (/2160p|4k|uhd/.test(text)) score += 40;
  else if (/1080p/.test(text)) score += 30;
  else if (/720p/.test(text)) score += 20;
  else if (/480p|576p/.test(text)) score += 8;
  if (/remux/.test(text)) score += 14;
  if (/bluray|blu ray|bdrip|brrip/.test(text)) score += 10;
  if (/web[- .]?dl/.test(text)) score += 8;
  if (/webrip/.test(text)) score += 6;
  if (item.poster) score += 20;
  if (item.backdrop) score += 10;
  if (item.tmdbId) score += 50;
  if (item.overview) score += 4;
  if (Number(item.rating || item.vote_average || item.voteAverage || 0) > 0) score += 3;
  if (playableUrl(item)) score += 5;
  score += sourceRank(selectBestSource(item.sources) || sourceForItem(item) || {});
  return score;
}

function cleanCatalogItem(item = {}, options = {}) {
  if (!item || typeof item !== 'object') return null;
  const streamUrl = playableUrl(item);
  const filename = filenameOf(item);
  const validation = validateMediaItem(
    { ...item, filename, file: item.file || filename, streamUrl },
    {
      kind: options.kind || item.type,
      allowFolders: options.allowFolders,
      requireEpisodes: options.requireEpisodes,
      episodeCount: options.episodeCount
    }
  );
  if (!validation.ok && !options.allowMetadataOnly) return null;

  const rawTitle = item.normalizedTitle || item.tmdbTitle || item.title || item.name || filename || streamUrl || '';
  const title = normalizeTitle(rawTitle);
  if (!title || title.length < 3) {
    rejectMedia('invalid normalized title', item, { normalizedTitle: title });
    return null;
  }

  const sourceYear = extractYear(`${filename} ${streamUrl}`) || extractYear(rawTitle);
  const year = String(sourceYear || validation.year || item.year || '').slice(0, 4);
  const sources = mergeSources(item.sources || [], sourceForItem({ ...item, streamUrl }));
  const bestSource = selectBestSource(sources);

  return {
    ...item,
    filename: item.filename || filename,
    streamUrl: bestSource?.url || streamUrl || '',
    url: item.url || streamUrl || '',
    sources,
    sourceName: bestSource?.source || sourceName(item, streamUrl),
    sourceHost: bestSource?.host || sourceHost(streamUrl),
    responseSpeed: bestSource?.responseSpeed ?? sourceResponseSpeed(item),
    lastVerified: bestSource?.lastVerified || sourceLastVerified(item),
    name: item.name && !options.forceTitle ? normalizeTitle(item.name) || title : title,
    title,
    year,
    normalizedTitle: title,
    normalizedKey: normalizedKey(`${title} ${year || ''}`)
  };
}

function dedupeKey(item = {}, options = {}) {
  if (item.tmdbId) return `tmdb:${item.tmdbId}`;
  const titleKey = normalizedKey(item.title || item.name);
  if (!titleKey) return '';
  return `${options.kind || item.type || 'title'}:${titleKey}:${item.year || ''}`;
}

function mergeCatalogItems(a = {}, b = {}) {
  const best = qualityScore(b) > qualityScore(a) ? b : a;
  const other = best === a ? b : a;
  const merged = { ...other, ...best };

  for (const field of [
    'tmdbId', 'imdbId', 'poster', 'backdrop', 'overview', 'rating', 'voteAverage',
    'genre', 'genres', 'genreIds', 'runtime', 'director', 'language',
    'originalLanguage', 'languageCode', 'productionCompanies', 'networks',
    'actors', 'aliases', 'category', 'addedAt'
  ]) {
    if ((merged[field] === undefined || merged[field] === null || merged[field] === '' || (Array.isArray(merged[field]) && !merged[field].length)) &&
        other[field] !== undefined && other[field] !== null && other[field] !== '') {
      merged[field] = other[field];
    }
  }

  merged.sources = mergeSources(a.sources || [], b.sources || [], sourceForItem(a), sourceForItem(b));
  const selected = selectBestSource(merged.sources);
  if (selected) {
    merged.streamUrl = selected.url;
    merged.sourceName = selected.source;
    merged.sourceHost = selected.host;
    merged.responseSpeed = selected.responseSpeed;
    merged.lastVerified = selected.lastVerified;
  }
  return merged;
}

function dedupeCatalog(items = [], options = {}) {
  const byKey = new Map();
  const removed = [];
  for (const raw of Array.isArray(items) ? items : []) {
    const item = cleanCatalogItem(raw, options);
    if (!item) continue;
    const key = dedupeKey(item, options);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, mergeCatalogItems(existing, item));
      removed.push(item);
    } else {
      byKey.set(key, item);
    }
  }
  removed.forEach(item => rejectMedia('duplicate encode or release merged', item, { normalizedTitle: item.normalizedTitle || item.title || item.name }));
  return Array.from(byKey.values());
}

module.exports = {
  cleanCatalogItem,
  dedupeCatalog,
  qualityScore,
  mergeSources,
  selectBestSource,
  sourceForItem,
  sourceHost
};
