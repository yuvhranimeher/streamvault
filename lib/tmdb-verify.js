const https = require('https');
const { normalizeTitle, extractYear, normalizedKey } = require('./normalize-title');

const TMDB_IMG = 'https://image.tmdb.org/t/p';

function validTmdbImage(url) {
  try {
    const parsed = new URL(String(url || ''));
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'image.tmdb.org' &&
      /^\/t\/p\/(?:original|w\d+)\//.test(parsed.pathname);
  } catch {
    return false;
  }
}

function tmdbImage(size, imgPath) {
  return imgPath ? `${TMDB_IMG}/${size}${imgPath}` : '';
}

function requestJson(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 8000
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`TMDB ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('TMDB timeout')));
    req.on('error', reject);
  });
}

function verifyConfidence(rawTitle, candidate, expectedYear = '') {
  const wanted = normalizedKey(rawTitle);
  const foundTitle = candidate?.title || candidate?.name || candidate?.original_title || candidate?.original_name || '';
  const found = normalizedKey(foundTitle);
  const foundYear = String(candidate?.release_date || candidate?.first_air_date || '').slice(0, 4);
  if (!wanted || !found) return { ok: false, score: 0, reason: 'empty title' };
  let score = 0;
  if (wanted === found) score += 0.72;
  else if (wanted.includes(found) || found.includes(wanted)) score += 0.52;
  const year = expectedYear || extractYear(rawTitle);
  if (year && foundYear && year === foundYear) score += 0.22;
  else if (!year || !foundYear) score += 0.08;
  if (candidate?.poster_path || candidate?.backdrop_path) score += 0.08;
  return { ok: score >= 0.72, score, reason: score >= 0.72 ? 'verified' : 'low confidence', foundTitle, foundYear };
}

async function searchTmdb({ title, year = '', type = 'movie', token }) {
  if (!token) return null;
  const clean = normalizeTitle(title);
  if (!clean || clean.length < 3) return null;
  const isSeries = type === 'tv' || type === 'series';
  const endpoint = isSeries ? 'search/tv' : 'search/movie';
  const yearParam = year ? `&${isSeries ? 'first_air_date_year' : 'year'}=${encodeURIComponent(year)}` : '';
  const url = `https://api.themoviedb.org/3/${endpoint}?query=${encodeURIComponent(clean)}${yearParam}&include_adult=false`;
  const data = await requestJson(url, token);
  const results = Array.isArray(data?.results) ? data.results : [];
  for (const candidate of results) {
    const confidence = verifyConfidence(clean, candidate, year);
    if (!confidence.ok) continue;
    return {
      tmdbId: candidate.id,
      tmdbTitle: candidate.title || candidate.name || clean,
      title: candidate.title || candidate.name || clean,
      year: (candidate.release_date || candidate.first_air_date || '').slice(0, 4) || year,
      poster: tmdbImage('w342', candidate.poster_path),
      backdrop: tmdbImage('w780', candidate.backdrop_path || candidate.poster_path),
      overview: candidate.overview || '',
      rating: candidate.vote_average || 0,
      voteAverage: candidate.vote_average || 0,
      popularity: candidate.popularity || 0,
      originalLanguage: candidate.original_language || '',
      genreIds: candidate.genre_ids || [],
      confidence
    };
  }
  return null;
}

module.exports = {
  searchTmdb,
  verifyConfidence,
  validTmdbImage,
  tmdbImage
};
