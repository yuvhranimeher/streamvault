// retry-enrich.js
const https = require("https");
const fs = require("fs");

const TMDB_KEY = "330e5a3933771b3df815897457a90ac8";
const catalog = JSON.parse(fs.readFileSync("catalog.json", "utf8"));
const cacheFile = "poster-cache.json";
let cache = {};
try { cache = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch {}

function aggressiveClean(title) {
  return title
    .replace(/\(.*?\)/g, '')           // remove anything in brackets
    .replace(/\[.*?\]/g, '')           // remove square brackets
    .replace(/\b(19|20)\d{2}\b/g, '') // remove years
    .replace(/\b(Hindi|English|Dual Audio|Multi Audio|BluRay|WEBRip|WEB-DL|HDTV|1080p|720p|480p|x264|x265|HEVC|AAC|DTS|NF|AMZN|ESub|MSubs)\b/gi, '')
    .replace(/[-_.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchTMDB(title, type) {
  return new Promise(resolve => {
    const mediaType = type === "series" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&page=1`;
    const req = https.get(url, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const j = JSON.parse(data);
          const r = j.results?.[0];
          if (!r) return resolve(null);
          resolve({
            poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
            backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
            overview: r.overview || "",
            year: (r.release_date || r.first_air_date || "").slice(0, 4),
            rating: r.vote_average ? r.vote_average.toFixed(1) : null,
            genre: "",
          });
        } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function retry() {
  const failedMovies = catalog.movies.filter(m => !m.poster);
  const failedSeries = catalog.series.filter(s => !s.poster);
  console.log(`Retrying: ${failedMovies.length} movies, ${failedSeries.length} series`);

  let hits = 0, done = 0;

  for (const movie of failedMovies) {
    const cleanedTitle = aggressiveClean(movie.title);
    if (!cleanedTitle) { done++; continue; }

    const retryKey = `retry_movie_${cleanedTitle}`;
    if (!cache[retryKey]) {
      const info = await fetchTMDB(cleanedTitle, "movie");
      cache[retryKey] = info || null;
      await sleep(100);
    }
    if (cache[retryKey]) {
      Object.assign(movie, cache[retryKey]);
      hits++;
    }
    done++;
    if (done % 500 === 0) {
      console.log(`  Movies: ${done}/${failedMovies.length} — ${hits} newly found`);
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
      fs.writeFileSync("catalog.json", JSON.stringify(catalog, null, 2));
    }
  }

  console.log(`\nMovies done. Starting series...`);
  done = 0;

  for (const show of failedSeries) {
    const cleanedTitle = aggressiveClean(show.title);
    if (!cleanedTitle) { done++; continue; }

    const retryKey = `retry_series_${cleanedTitle}`;
    if (!cache[retryKey]) {
      const info = await fetchTMDB(cleanedTitle, "series");
      cache[retryKey] = info || null;
      await sleep(100);
    }
    if (cache[retryKey]) {
      Object.assign(show, cache[retryKey]);
      hits++;
    }
    done++;
    if (done % 100 === 0) {
      console.log(`  Series: ${done}/${failedSeries.length} — ${hits} newly found`);
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
      fs.writeFileSync("catalog.json", JSON.stringify(catalog, null, 2));
    }
  }

  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  fs.writeFileSync("catalog.json", JSON.stringify(catalog, null, 2));
  console.log(`\n✓ Retry done. ${hits} additional posters found.`);
}

retry().catch(console.error);