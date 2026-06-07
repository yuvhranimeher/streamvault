const fs = require("fs");
const path = require("path");

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function pick(o, keys) {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function boolPick(o, keys) {
  const v = pick(o, keys);
  return !!v;
}

function normalizeRow(row) {
  const d = obj(row.data);
  const item = obj(d.item || d.details || d.movie || d.series || d.data || d);
  const request = obj(row.request);

  return {
    key: `${request.type || item.type || ""}:${request.title || item.title || item.name || ""}`,
    request,
    status: row.status || 0,
    ok: !!(row.ok || d.ok || item.ok),

    title: pick(item, ["title", "name"]) || request.title || null,
    type: pick(item, ["type", "media_type"]) || request.type || null,
    year: String(pick(item, ["year", "releaseYear", "first_air_date", "release_date"]) || ""),
    rating: String(pick(item, ["rating", "vote_average"]) || ""),
    runtime: String(pick(item, ["runtime", "duration"]) || ""),
    language: pick(item, ["language", "original_language"]) || "",
    genre: pick(item, ["genre", "genres"]) || "",

    poster: boolPick(item, ["poster", "poster_path"]),
    backdrop: boolPick(item, ["backdrop", "backdrop_path"]),
    overview: boolPick(item, ["overview", "description"]),

    ratingsCount: arr(item.ratings || d.ratings).length,
    castCount: arr(item.cast || d.cast).length,
    crewCount: arr(item.crew || d.crew).length,
    trailersCount: arr(item.trailers || d.trailers || item.videos || d.videos).length,
    similarCount: arr(item.similar || d.similar || item.recommendations || d.recommendations).length,
    productionCompaniesCount: arr(item.productionCompanies || item.production_companies || d.productionCompanies).length,
    moreByDirectorCount: arr(item.moreByDirector || d.moreByDirector).length,
    aboutCount: arr(item.about || d.about).length,

    topKeys: Object.keys(d).sort(),
    itemKeys: Object.keys(item).sort()
  };
}

function run(inName, outName, mdName, label) {
  const inFile = path.join(__dirname, "out", inName);
  const outFile = path.join(__dirname, "out", outName);
  const mdFile = path.join(__dirname, "out", mdName);

  if (!fs.existsSync(inFile)) {
    console.log(`${label} fixture missing: ${inFile}`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(inFile, "utf8"));
  const items = (raw.results || []).map(normalizeRow);

  fs.writeFileSync(outFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: items.length,
    items
  }, null, 2));

  let md = `# ${label} Details Shape Report\n\nRows: ${items.length}\n\n`;
  for (const x of items) {
    md += `## ${x.request.type}: ${x.request.title}\n\n`;
    md += `- ok: ${x.ok}\n`;
    md += `- title: ${x.title}\n`;
    md += `- type: ${x.type}\n`;
    md += `- genre: ${x.genre}\n`;
    md += `- poster/backdrop/overview: ${x.poster}/${x.backdrop}/${x.overview}\n`;
    md += `- ratings/cast/crew/trailers/similar/companies/about: ${x.ratingsCount}/${x.castCount}/${x.crewCount}/${x.trailersCount}/${x.similarCount}/${x.productionCompaniesCount}/${x.aboutCount}\n\n`;
  }

  fs.writeFileSync(mdFile, md);
  console.log(`Wrote ${outFile}`);
  console.log(`Wrote ${mdFile}`);
}

module.exports = { run };

if (require.main === module) {
  run(process.argv[2], process.argv[3], process.argv[4], process.argv[5] || "Details");
}
