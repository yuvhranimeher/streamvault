'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'SV_SERIES_EPISODE_AUTHORITY_V3';
const LEGACY_V2 = 'SV_SERIES_EPISODE_AUTHORITY_V2';
const LEGACY_V1 = 'SV_SERIES_EPISODE_AUTHORITY_V1';

function installSeriesEpisodeAuthorityV3() {
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
  // ${LEGACY_V2}
  // ${LEGACY_V1}
  // FTP catalogs do not guarantee that every season value is already an array.
  // Normalize arrays, keyed episode objects, strings, and null entries before
  // building the detail payload so one malformed series cannot crash the route.
  const localSeries = _seriesList || buildSeriesListSync();
  const ftpSeries = getCachedSeries()
    .filter(s => !isCartoonOrAnime(s))
    .map((s, i) => ({
      id: \`ftp_series_\${i}\`,
      name: s.title,
      title: s.title,
      poster: s.poster || null,
      backdrop: s.backdrop || s.poster || null,
      tmdbId: s.tmdbId || null,
      year: s.year || '',
      rating: s.rating || null,
      type: 'series',
      genre: s.genre || '',
      category: s.category || 'Series',
      seasons: Object.entries(s.seasons || {}).reduce((acc, [season, episodes]) => {
        const episodeList = Array.isArray(episodes)
          ? episodes
          : (episodes && typeof episodes === 'object' ? Object.values(episodes) : []);

        acc[season] = episodeList
          .filter(ep => ep != null)
          .map((rawEpisode, j) => {
            const ep = rawEpisode && typeof rawEpisode === 'object'
              ? rawEpisode
              : { url: String(rawEpisode || '') };
            const streamUrl = ep.url || ep.streamUrl || ep.src || ep.link || '';
            return {
              id: ep.id || \`ftp_ep_\${i}_\${season}_\${j}\`,
              name: ep.name || ep.title || \`Episode \${j + 1}\`,
              episode: ep.episode || ep.number || j + 1,
              season: parseInt(season, 10) || ep.season || 1,
              streamUrl,
              url: streamUrl,
              streamId: ep.streamId != null ? ep.streamId : null,
              isFtp: true
            };
          })
          .filter(ep => ep.streamUrl || ep.streamId != null);
        return acc;
      }, {}),
      isFtp: true,
      _isSeries: true
    }));

  return [...localSeries, ...ftpSeries];
}
`;

  source = source.slice(0, start) + replacement + source.slice(end);
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[Startup] Installed global series episode authority V3.');
  return true;
}

if (require.main === module) {
  try {
    installSeriesEpisodeAuthorityV3();
  } catch (error) {
    console.error('[Series episode authority V3] install failed:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { installSeriesEpisodeAuthorityV3 };
