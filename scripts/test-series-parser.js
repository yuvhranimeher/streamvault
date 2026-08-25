'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildSeriesCatalog,
  normalizeSeriesKey,
  parseSeriesEntry,
  walkVideoFiles,
} = require('../lib/series-library');

function entry(relativePath) {
  return {
    dir: path.dirname(relativePath),
    file: path.basename(relativePath),
    relativePath,
    type: 'episode',
  };
}

function expect(relativePath, expected) {
  const actual = parseSeriesEntry(entry(relativePath));
  assert(actual, `Expected path to parse: ${relativePath}`);
  for (const [key, value] of Object.entries(expected)) {
    assert.deepStrictEqual(actual[key], value, `${relativePath}: ${key}`);
  }
}

const cases = [
  ['Breaking Bad/Season 01/Breaking.Bad.S01E01.1080p.mkv', { showName: 'Breaking Bad', season: 1, episode: 1 }],
  ['Dark/S02/Dark.2x03.mkv', { showName: 'Dark', season: 2, episode: 3 }],
  ['Sherlock/Season 1/01.mkv', { showName: 'Sherlock', season: 1, episode: 1 }],
  ['Loki/Season 01/Episode 02.mkv', { showName: 'Loki', season: 1, episode: 2 }],
  ['The Boys/The.Boys.S03E04.WEB-DL.mkv', { showName: 'The Boys', season: 3, episode: 4 }],
  ['House of the Dragon/Season 02/House.of.the.Dragon.S02E01.mkv', { showName: 'House of the Dragon', season: 2, episode: 1 }],
  ['Some Show/Specials/S00E01.mkv', { showName: 'Some Show', season: 0, episode: 1 }],
  ['Show Name/Season 1/1080p/E03.mkv', { showName: 'Show Name', season: 1, episode: 3 }],
  ['Show Name/Series 01/EP01.mkv', { showName: 'Show Name', season: 1, episode: 1 }],
  ['Show Name/Season_01/Show Name - S01E02 - Pilot.mkv', { showName: 'Show Name', season: 1, episode: 2, epTitle: 'Pilot' }],
  ['Show Name/Season.1/Show Name Season 1 Episode 3.mkv', { showName: 'Show Name', season: 1, episode: 3 }],
  ['Show Name/S1/Show Name E4.mkv', { showName: 'Show Name', season: 1, episode: 4 }],
  ['Show Name/S01/E1.mkv', { showName: 'Show Name', season: 1, episode: 1 }],
  ['Show Name/Season 1/1.mkv', { showName: 'Show Name', season: 1, episode: 1 }],
  ['Show Name/Specials/Special 1.mkv', { showName: 'Show Name', season: 0, episode: 1 }],
  ['The Last of Us/Season 01/1080p/The.Last.of.Us.S01E01.mkv', { showName: 'The Last of Us', season: 1, episode: 1 }],
  ['The Last of Us/The.Last.of.Us.S01.COMPLETE.1080p/The.Last.of.Us.S01E02.mkv', { showName: 'The Last of Us', season: 1, episode: 2 }],
  ['Death Note/Season 01/Death Note - Episode - 01 - Rebirth.mkv', { showName: 'Death Note', season: 1, episode: 1, epTitle: 'Rebirth' }],
  ['Anime Show/Season 02/Anime Show 2nd Season - 01.mkv', { showName: 'Anime Show', season: 2, episode: 1 }],
  ['Ghost in the Shell SAC 2045/Season 02/[Group] Ghost in the Shell SAC 2045 Season 2 - 01 [1080p].mkv', { season: 2, episode: 1 }],
  ['1923 (TV Series 2022-2025)/Season 01/1923.S01E01.1080p.mkv', { showName: '1923', season: 1, episode: 1 }],
  ['Iryu (TV Series 2006-2014)/Season 03/Iryu Team Medical Dragon (Season 3) - 01.mkv', { season: 3, episode: 1 }],
];
for (const [relativePath, expected] of cases) expect(relativePath, expected);

assert.strictEqual(parseSeriesEntry(entry('Show Name/Season 1/not-an-episode.mkv')), null);
assert.strictEqual(parseSeriesEntry(entry('random-video.mkv')), null);
assert.strictEqual(parseSeriesEntry(null), null);
assert.strictEqual(normalizeSeriesKey('The.Boys'), normalizeSeriesKey('The Boys (2019)'));
assert.strictEqual(normalizeSeriesKey('The_Boys'), normalizeSeriesKey('The Boys 2019'));

const conflict = parseSeriesEntry(entry('Conflict Show/Season 1/Conflict.Show.S02E03.mkv'));
assert.deepStrictEqual(conflict.seasonConflict, { filename: 2, directory: 1 });
assert.strictEqual(conflict.season, 2);

const indexed = [
  { type: 'movie', dir: '/movies', file: 'Movie.mkv' },
  entry('The Boys (2019)/Season 01/The.Boys.S01E01.720p.mkv'),
  entry('The_Boys/Season 01/The.Boys.S01E01.1080p.mkv'),
  entry('The Boys/Season 01/The.Boys.S01E02.mkv'),
];
const built = buildSeriesCatalog(indexed);
assert.strictEqual(built.shows.length, 1);
assert.strictEqual(built.shows[0].seasons['1'].length, 2);
assert.strictEqual(built.shows[0].seasons['1'][0].streamId, 2, '1080p duplicate should retain its real file-index stream ID');
assert.strictEqual(built.diagnostics.duplicates, 1);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'streamvault-series-'));
try {
  fs.mkdirSync(path.join(tempRoot, 'Walker Show', 'Season 01'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'Walker Show', 'Season 01', 'E01.mkv'), '');
  fs.writeFileSync(path.join(tempRoot, 'Walker Show', 'Season 01', 'E01.srt'), '');
  fs.writeFileSync(path.join(tempRoot, 'Walker Show', 'poster.jpg'), '');
  const scan = walkVideoFiles(tempRoot);
  assert.deepStrictEqual(scan.files.map(file => file.relativePath), ['Walker Show/Season 01/E01.mkv']);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log(`Series parser tests passed: ${cases.length} path cases plus malformed, grouping, duplicate, conflict, and walker checks.`);
