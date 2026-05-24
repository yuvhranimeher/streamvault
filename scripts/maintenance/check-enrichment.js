// check-enrichment.js
const fs = require("fs");
const catalog = JSON.parse(fs.readFileSync("catalog.json", "utf8"));

const moviesWithPoster = catalog.movies.filter(m => m.poster).length;
const moviesWithoutPoster = catalog.movies.filter(m => !m.poster).length;
const seriesWithPoster = catalog.series.filter(s => s.poster).length;
const seriesWithoutPoster = catalog.series.filter(s => !s.poster).length;

console.log(`Movies:  ${moviesWithPoster} with poster / ${moviesWithoutPoster} without / ${catalog.movies.length} total`);
console.log(`Series:  ${seriesWithPoster} with poster / ${seriesWithoutPoster} without / ${catalog.series.length} total`);