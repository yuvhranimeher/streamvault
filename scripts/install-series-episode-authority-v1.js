'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'SV_SERIES_EPISODE_AUTHORITY_V1';

function installSeriesEpisodeAuthority() {
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
  // Detail hydration must see every playable series candidate. Do not dedupe
  // summaries before playability filtering: a zero-episode homepage summary can
  // otherwise hide the full FTP/massive-catalog copy of the same show.
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
        acc[season] = (episodes || []).map((ep, j) => ({
          id: ep.id || \`ftp_ep_\${i}_\${season}_\${j}\`,
          name: ep.name || \`Episode \${j + 1}\`,
          episode: ep.episode || j + 1,
          season: parseInt(season, 10) || 1,
          streamUrl: ep.url || ep.streamUrl,
          url: ep.url || ep.streamUrl,
          isFtp: true
        }));
        return acc;
      }, {}),
      isFtp: true,
      _isSeries: true
    }));

  let massiveSeries = [];
  try {
    loadMassiveCatalog();
    massiveSeries = Array.isArray(_massiveSeries)
      ? _massiveSeries.map(show => ({
          ...show,
          type: 'series',
          _isSeries: true,
          isSummary: false
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
  console.log('[Startup] Installed global series episode authority.');
  return true;
}

if (require.main === module) {
  try {
    installSeriesEpisodeAuthority();
  } catch (error) {
    console.error('[Series episode authority] install failed:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { installSeriesEpisodeAuthority };
