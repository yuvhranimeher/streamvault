// enrich-catalog.js
const https = require("https");
const fs = require("fs");

const TMDB_KEY = "330e5a3933771b3df815897457a90ac8";
const catalog = JSON.parse(fs.readFileSync("catalog.json", "utf8"));
const cacheFile = "poster-cache.json";
let cache = {};
try { cache = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch {}

function fetchTMDB(title, year, type) {
  return new Promise(resolve => {
    const mediaType = type === "series" ? "tv" : "movie";
    const yearParam = year ? `&year=${year}` : "";
    const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}${yearParam}&page=1`;
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

async function enrich() {
  const movies = catalog.movies;
  const series = catalog.series;

  console.log(`Movies: ${movies.length} | Series: ${series.length}`);
  let done = 0, hits = 0;

  for (const movie of movies) {
    const key = `movie_${movie.title}_${movie.year || ""}`;
    if (!cache[key]) {
      const info = await fetchTMDB(movie.title, movie.year, "movie");
      cache[key] = info || null;
      await sleep(100);
    }
    if (cache[key]) { Object.assign(movie, cache[key]); hits++; }
    done++;
    if (done % 500 === 0) {
      console.log(`  Movies: ${done}/${movies.length} — ${hits} with posters`);
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
      fs.writeFileSync("catalog.json", JSON.stringify(catalog, null, 2));
    }
  }

  console.log(`\nMovies done. Starting series...`);
  done = 0;

  for (const show of series) {
    const key = `series_${show.title}_`;
    if (!cache[key]) {
      const info = await fetchTMDB(show.title, null, "series");
      cache[key] = info || null;
      await sleep(100);
    }
    if (cache[key]) { Object.assign(show, cache[key]); hits++; }
    done++;
    if (done % 100 === 0) {
      console.log(`  Series: ${done}/${series.length}`);
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
      fs.writeFileSync("catalog.json", JSON.stringify(catalog, null, 2));
    }
  }

  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  fs.writeFileSync("catalog.json", JSON.stringify(catalog, null, 2));
  console.log(`\n✓ Done. ${hits} total enriched.`);
}

enrich().catch(console.error);