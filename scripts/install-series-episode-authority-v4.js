'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'SV_SERIES_EPISODE_AUTHORITY_V4';
const LEGACY_MARKERS = [
  'SV_SERIES_EPISODE_AUTHORITY_V3',
  'SV_SERIES_EPISODE_AUTHORITY_V2',
  'SV_SERIES_EPISODE_AUTHORITY_V1'
];

function installSeriesEpisodeAuthorityV4() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  let source = fs.readFileSync(serverPath, 'utf8');

  if (source.includes(MARKER)) return false;

  const startNeedle = 'function allApiSeriesForDetails() {';
  const nextNeedle = '\nfunction splitDetailGenres';
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(nextNeedle, start);

  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Could not locate allApiSeriesForDetails() in server.js');
  }

  const replacement = `function allApiSeriesForDetails() {
  // ${MARKER}
  // ${LEGACY_MARKERS.join(' ')}
  // getCachedSeries() uses an array-of-season-objects shape:
  //   [{ season, episodes: [...] }, ...]
  // while the massive catalog already uses { seasonNumber: [episodes] }.
  // Normalize both shapes into the detail API's canonical seasons object.
  const localSeries = _seriesList || buildSeriesListSync();

  function normalizeEpisode(rawEpisode, showIndex, seasonNumber, episodeIndex) {
    const ep = rawEpisode && typeof rawEpisode === 'object'
      ? rawEpisode
      : { url: String(rawEpisode || '') };
    const streamUrl = ep.streamUrl || ep.url || ep.src || ep.link || '';
    const streamId = ep.streamId != null ? ep.streamId : null;
    if (!streamUrl && streamId == null) return null;
    return {
      ...ep,
      id: ep.id || \`ftp_ep_\${showIndex}_\${seasonNumber}_\${episodeIndex}\`,
      name: ep.name || ep.title || ep.epTitle || \`Episode \${episodeIndex + 1}\`,
      epTitle: ep.epTitle || ep.name || ep.title || \`Episode \${episodeIndex + 1}\`,
      episode: Number(ep.episode || ep.number || ep.episodeNumber || episodeIndex + 1) || episodeIndex + 1,
      season: Number(ep.season || ep.seasonNumber || seasonNumber) || 1,
      streamUrl,
      url: streamUrl,
      streamId,
      isFtp: true
    };
  }

  function normalizeSeasons(rawSeasons, showIndex) {
    const out = {};

    if (Array.isArray(rawSeasons)) {
      rawSeasons.forEach((seasonObj, seasonIndex) => {
        if (!seasonObj) return;
        const seasonNumber = Number(
          seasonObj.season ?? seasonObj.seasonNumber ?? seasonObj.number ?? seasonIndex + 1
        ) || seasonIndex + 1;
        const rawEpisodes = Array.isArray(seasonObj.episodes)
          ? seasonObj.episodes
          : Array.isArray(seasonObj.items)
            ? seasonObj.items
            : [];
        const episodes = rawEpisodes
          .map((ep, episodeIndex) => normalizeEpisode(ep, showIndex, seasonNumber, episodeIndex))
          .filter(Boolean);
        if (episodes.length) out[seasonNumber] = episodes;
      });
      return out;
    }

    if (rawSeasons && typeof rawSeasons === 'object') {
      Object.entries(rawSeasons).forEach(([seasonKey, seasonValue], seasonIndex) => {
        const seasonNumber = Number(seasonKey) || Number(seasonValue?.season || seasonValue?.seasonNumber) || seasonIndex + 1;
        const rawEpisodes = Array.isArray(seasonValue)
          ? seasonValue
          : Array.isArray(seasonValue?.episodes)
            ? seasonValue.episodes
            : Array.isArray(seasonValue?.items)
              ? seasonValue.items
              : [];
        const episodes = rawEpisodes
          .map((ep, episodeIndex) => normalizeEpisode(ep, showIndex, seasonNumber, episodeIndex))
          .filter(Boolean);
        if (episodes.length) out[seasonNumber] = episodes;
      });
    }

    return out;
  }

  const ftpSeries = getCachedSeries()
    .filter(s => !isCartoonOrAnime(s))
    .map((s, i) => ({
      id: s.id || \`ftp_series_\${i}\`,
      name: s.name || s.title,
      title: s.title || s.name,
      poster: s.poster || null,
      backdrop: s.backdrop || s.poster || null,
      tmdbId: s.tmdbId || null,
      year: s.year || '',
      rating: s.rating || null,
      type: 'series',
      genre: s.genre || '',
      category: s.category || 'Series',
      seasons: normalizeSeasons(s.seasons, i),
      isFtp: true,
      _isSeries: true
    }));

  let massiveSeries = [];
  try {
    loadMassiveCatalog();
    massiveSeries = Array.isArray(_massiveSeries)
      ? _massiveSeries.map((s, i) => ({
          ...s,
          type: 'series',
          _isSeries: true,
          isSummary: false,
          seasons: normalizeSeasons(s.seasons, \`massive_\${i}\`)
        }))
      : [];
  } catch (error) {
    if (SV_DETAIL_VERBOSE) console.warn('[Series detail] Massive catalog unavailable:', error.message);
  }

  return [...localSeries, ...ftpSeries, ...massiveSeries];
}
`;

  source = source.slice(0, start) + replacement + source.slice(end);
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[Startup] Installed global series episode authority V4.');
  return true;
}

if (require.main === module) {
  try {
    installSeriesEpisodeAuthorityV4();
  } catch (error) {
    console.error('[Series episode authority V4] install failed:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { installSeriesEpisodeAuthorityV4 };
