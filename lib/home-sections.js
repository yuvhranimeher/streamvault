const { cleanDisplayTitle, normalizedKey } = require('./normalize-title');

function listText(values = []) {
  return values.flat().filter(Boolean).map(value => {
    if (typeof value === 'string') return value;
    return value.name || value.english_name || '';
  }).join(' ').toLowerCase();
}

function companyText(item) {
  return listText([item.productionCompanies, item.production_companies, item.networks, item.network]);
}

function genreNames(item) {
  return [
    item.genre,
    ...(Array.isArray(item.genres) ? item.genres.map(g => typeof g === 'string' ? g : g.name) : [])
  ].filter(Boolean).join(',').split(/[,/|]/).map(g => g.trim().toLowerCase()).filter(Boolean);
}

function hasCompany(item, names) {
  const text = companyText(item);
  return names.some(name => text.includes(name.toLowerCase()));
}

function language(item) {
  return String(item.originalLanguage || item.languageCode || item.original_language || item.language || '').toLowerCase();
}

function country(item) {
  return listText([item.originCountry, item.origin_country, item.productionCountries, item.production_countries]);
}

function rating(item) {
  return Number(item.voteAverage || item.vote_average || item.rating || 0) || 0;
}

function popularity(item) {
  return Number(item.popularity || item.trendingScore || 0) || 0;
}

function isSeries(item) {
  return item.type === 'tv' || item.type === 'series' || Number(item.seasonCount || 0) > 0 || Number(item.episodeCount || 0) > 0;
}

function hasGenre(item, names) {
  const genres = genreNames(item);
  return names.some(name => genres.includes(name.toLowerCase()));
}

function hasArt(item) {
  return !!(item && (item.poster || item.backdrop));
}

function titleText(item) {
  return cleanDisplayTitle(item?.displayTitle || item?.tmdbTitle || item?.normalizedTitle || item?.name || item?.title || '');
}

function metadataText(item) {
  return normalizedKey([
    titleText(item),
    item?.tmdbTitle,
    ...(Array.isArray(item?.aliases) ? item.aliases : []),
    item?.genre,
    ...(Array.isArray(item?.genres) ? item.genres.map(g => typeof g === 'string' ? g : g.name) : []),
    ...(Array.isArray(item?.productionCompanies) ? item.productionCompanies.map(c => typeof c === 'string' ? c : c.name) : []),
    ...(Array.isArray(item?.networks) ? item.networks.map(n => typeof n === 'string' ? n : n.name) : [])
  ].filter(Boolean).join(' '));
}

function hasAnyText(item, patterns) {
  const text = metadataText(item);
  const cleanTitle = normalizedKey(titleText(item));
  return patterns.some(pattern => {
    const raw = String(pattern || '');
    if (raw.startsWith('title:')) return cleanTitle === normalizedKey(raw.slice(6));
    const phrase = normalizedKey(raw);
    if (!phrase) return false;
    return (` ${text} `).includes(` ${phrase} `);
  });
}

function dedupeItems(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item?.tmdbId || item?.id || normalizedKey(`${titleText(item)} ${item?.year || ''}`));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mergeSection(key, strictItems, fallbackItems, min = 12) {
  const strict = Array.isArray(strictItems) ? strictItems : [];
  if (strict.length >= min) return sectionSort(key, strict).slice(0, 240);
  return sectionSort(key, dedupeItems([...strict, ...(fallbackItems || [])])).slice(0, 240);
}

const MAJOR_FALLBACKS = {
  netflix: [
    'netflix', 'stranger things', 'wednesday', 'squid game', 'money heist',
    'narcos', 'the witcher', 'bridgerton', 'the crown', 'black mirror', 'ozark',
    'cobra kai', 'umbrella academy', 'sex education', 'arcane', 'mindhunter',
    'extraction', 'red notice', 'bird box', 'enola holmes', 'the gray man'
  ],
  marvel: [
    'marvel studios', 'avengers', 'iron man', 'captain america', 'thor', 'hulk',
    'black panther', 'doctor strange', 'guardians of the galaxy', 'ant man', 'ant-man',
    'captain marvel', 'spider man', 'spider-man', 'deadpool', 'x men', 'x-men',
    'wolverine', 'fantastic four', 'venom', 'loki', 'wanda', 'vision', 'shang chi',
    'eternals', 'daredevil', 'moon knight', 'ms marvel', 'hawkeye'
  ],
  dc: [
    'dc studios', 'dc comics', 'batman', 'dark knight', 'superman', 'wonder woman',
    'justice league', 'aquaman', 'shazam', 'suicide squad', 'joker', 'harley quinn',
    'black adam', 'the flash', 'green lantern', 'watchmen', 'constantine',
    'peacemaker', 'blue beetle', 'man of steel', 'gotham', 'arrow', 'supergirl'
  ],
  universal: [
    'universal pictures', 'jurassic park', 'jurassic world', 'fast and furious', 'fast & furious',
    'despicable me', 'minions', 'bourne', 'title:the mummy', 'mummy returns', 'tomb of the dragon emperor', 'title:jaws', 'back to the future',
    'the purge', 'pitch perfect', 'bridget jones'
  ],
  disney: [
    'walt disney', 'disney', 'pixar', 'lucasfilm', 'toy story', 'title:frozen', 'frozen ii', 'moana',
    'encanto', 'title:coco', 'inside out', 'finding nemo', 'title:cars', 'cars 2', 'cars 3', 'incredibles',
    'lion king', 'aladdin', 'title:mulan', 'beauty and the beast', 'little mermaid',
    'pirates of the caribbean', 'star wars the', 'rogue one', 'solo a star wars story', 'mandalorian', 'ratatouille', 'zootopia',
    'title:tangled', 'monsters inc'
  ]
};

function strictSectionPredicates() {
  return {
    netflix: item => hasCompany(item, ['Netflix']),
    marvel: item => hasCompany(item, ['Marvel Studios']),
    dc: item => hasCompany(item, ['DC Studios', 'DC Entertainment', 'DC Films']),
    universal: item => hasCompany(item, ['Universal Pictures']),
    disney: item => hasCompany(item, ['Walt Disney Pictures', 'Walt Disney Studios', 'Disney', 'Pixar', 'Lucasfilm']),
    hbo: item => hasCompany(item, ['HBO', 'Home Box Office']),
    apple: item => hasCompany(item, ['Apple TV+', 'Apple Studios', 'Apple Original Films']),
    indian: item => ['hi', 'bn', 'ta', 'te', 'ml', 'kn', 'pa', 'mr', 'gu'].includes(language(item)),
    koreanDrama: item => language(item) === 'ko' || country(item).includes('kr') || country(item).includes('korea'),
    anime: item => language(item) === 'ja' && hasGenre(item, ['Animation']),
    horrorNights: item => hasGenre(item, ['Horror']),
    cyberpunkScifi: item => hasGenre(item, ['Science Fiction', 'Sci-Fi', 'Sci-Fi & Fantasy']),
    topRated: item => rating(item) >= 8,
    series: item => isSeries(item)
  };
}

function sectionSort(key, items) {
  const sorted = [...items];
  if (key === 'trending') {
    return sorted.sort((a, b) => popularity(b) - popularity(a) || rating(b) - rating(a));
  }
  if (key === 'topRated') return sorted.sort((a, b) => rating(b) - rating(a) || popularity(b) - popularity(a));
  return sorted.sort((a, b) => {
    const byYear = (Number(b.year) || 0) - (Number(a.year) || 0);
    return byYear || rating(b) - rating(a) || popularity(b) - popularity(a);
  });
}

function buildHomeSections(items = {}) {
  const movies = Array.isArray(items.movies) ? items.movies : [];
  const series = Array.isArray(items.series) ? items.series : [];
  const all = [...movies, ...series].filter(item => item && item.approvedForHome && hasArt(item));
  const predicates = strictSectionPredicates();
  const sections = {};
  sections.trending = mergeSection('trending', all.filter(item => popularity(item) > 0), all, 12);
  sections.series = sectionSort('series', all.filter(predicates.series)).slice(0, 240);
  sections.new = sectionSort('new', all).slice(0, 240);
  sections.recentlyAdded = sections.new;
  sections.allMovies = sectionSort('allMovies', movies.filter(item => item.approvedForHome && hasArt(item))).slice(0, 300);
  Object.entries(predicates).forEach(([key, predicate]) => {
    if (key === 'series') return;
    const strictItems = all.filter(predicate);
    const fallbackItems = MAJOR_FALLBACKS[key] ? all.filter(item => hasAnyText(item, MAJOR_FALLBACKS[key])) : [];
    sections[key] = mergeSection(key, strictItems, fallbackItems, MAJOR_FALLBACKS[key] ? 8 : 12);
  });
  return sections;
}

module.exports = {
  buildHomeSections,
  strictSectionPredicates,
  sectionSort,
  genreNames,
  language,
  popularity,
  rating
};
