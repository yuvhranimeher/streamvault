'use strict';

const assert = require('assert/strict');
const {
  createAudioSessionController,
  createMediaSessionKey,
  createModalNavigationSnapshot,
  determinePreferredLanguage,
  selectAudioTrack,
} = require('../lib/frontend-playback-session');

function track(index, language, options = {}) {
  return {
    index,
    streamIndex: options.streamIndex ?? index,
    relativeIndex: options.relativeIndex ?? index,
    language,
    codec: options.codec || 'aac',
    channels: options.channels ?? 2,
    bitrate: options.bitrate ?? 128000,
    ...options,
  };
}

function automatic(metadata, tracks, options = {}) {
  const preferred = determinePreferredLanguage(metadata);
  return selectAudioTrack({
    preferredLanguage: preferred.language,
    titleMetadata: metadata,
    audioStreams: tracks,
    trustedIndex: options.trustedIndex,
    trustedReason: options.trustedReason,
  });
}

const englishDualAudio = [
  track(0, 'hi', { default: true, title: 'Hindi 5.1' }),
  track(1, 'en', { title: 'English 5.1' }),
];

const cases = [
  ['English title with Hindi first selects English', () => {
    assert.equal(automatic({ category: 'English Movies' }, englishDualAudio).selectedIndex, 1);
  }],
  ['English title ignores Hindi container default', () => {
    assert.equal(automatic({ original_language: 'en' }, englishDualAudio, {
      trustedIndex: 0,
      trustedReason: 'source-default-track',
    }).selectedIndex, 1);
  }],
  ['English Dual Audio filename does not imply Hindi preference', () => {
    const result = automatic({
      category: 'English Movies',
      filename: 'Example [Dual Audio][Hindi 5.1+English 5.1].mkv',
    }, englishDualAudio);
    assert.equal(result.preferredLanguage, 'en');
    assert.equal(result.selectedIndex, 1);
  }],
  ['Hindi title selects Hindi', () => {
    assert.equal(automatic({ category: 'Hindi Movies' }, [
      track(0, 'en', { default: true }),
      track(1, 'hi'),
    ]).selectedIndex, 1);
  }],
  ['Normal English beats commentary and descriptive English', () => {
    assert.equal(automatic({ category: 'English Movies' }, [
      track(0, 'en', { default: true, title: 'Director Commentary' }),
      track(1, 'en', { title: 'English Audio Description' }),
      track(2, 'en', { title: 'English Main' }),
    ]).selectedIndex, 2);
  }],
  ['Manual Hindi override remains within the current movie', () => {
    const session = createAudioSessionController();
    session.begin({
      mediaType: 'movie',
      mediaId: 'avengers',
      sourceIdentity: 'avengers-source',
      titleMetadata: { category: 'English Movies' },
    });
    assert.equal(session.select(englishDualAudio).selectedIndex, 1);
    session.setManual(0, 0);
    assert.equal(session.select(englishDualAudio).selectedIndex, 0);
  }],
  ['Seek preserves the current manual override', () => {
    const session = createAudioSessionController();
    session.begin({
      mediaType: 'movie',
      mediaId: 'seek-fixture',
      sourceIdentity: 'seek-source',
      titleMetadata: { category: 'English Movies' },
    });
    session.setManual(0, 0);
    assert.equal(session.select(englishDualAudio).selectedIndex, 0);
  }],
  ['Subtitle changes preserve the current manual override', () => {
    const session = createAudioSessionController();
    session.begin({
      mediaType: 'movie',
      mediaId: 'subtitle-fixture',
      sourceIdentity: 'subtitle-source',
      titleMetadata: { category: 'English Movies' },
    });
    session.setManual(0, 0);
    assert.equal(session.select(englishDualAudio).reason, 'manual-session-selection');
  }],
  ['HLS reinitialization preserves the current manual override', () => {
    const session = createAudioSessionController();
    session.begin({
      mediaType: 'movie',
      mediaId: 'hls-fixture',
      sourceIdentity: 'hls-source',
      titleMetadata: { category: 'English Movies' },
    });
    session.setManual(0, 0);
    assert.equal(session.select(englishDualAudio).selectedIndex, 0);
    assert.equal(session.select(englishDualAudio).selectedIndex, 0);
  }],
  ['Opening another English movie clears the Hindi override', () => {
    const session = createAudioSessionController();
    session.begin({
      mediaType: 'movie',
      mediaId: 'movie-one',
      sourceIdentity: 'movie-one-source',
      titleMetadata: { category: 'English Movies' },
    });
    session.setManual(0, 0);
    session.begin({
      mediaType: 'movie',
      mediaId: 'movie-two',
      sourceIdentity: 'movie-two-source',
      titleMetadata: { category: 'English Movies' },
    });
    assert.equal(session.snapshot().manualIndex, null);
    assert.equal(session.select(englishDualAudio).selectedIndex, 1);
  }],
  ['Opening another episode resets to the episode preferred language', () => {
    const session = createAudioSessionController();
    session.begin({
      mediaType: 'series',
      mediaId: 'breaking-bad',
      season: 1,
      episode: 1,
      sourceIdentity: 'bb-s1e1',
      titleMetadata: { category: 'TV-WEB-Series' },
    });
    session.setManual(0, 0);
    session.begin({
      mediaType: 'series',
      mediaId: 'breaking-bad',
      season: 1,
      episode: 2,
      sourceIdentity: 'bb-s1e2',
      titleMetadata: { category: 'TV-WEB-Series' },
    });
    assert.equal(session.snapshot().manualIndex, null);
    assert.equal(session.select(englishDualAudio).selectedIndex, 1);
  }],
  ['Movie and series session keys cannot collide', () => {
    const movieKey = createMediaSessionKey({
      mediaType: 'movie',
      mediaId: '42',
      sourceIdentity: 'source-42',
    });
    const seriesKey = createMediaSessionKey({
      mediaType: 'series',
      mediaId: '42',
      season: 1,
      episode: 1,
      sourceIdentity: 'source-42',
    });
    assert.notEqual(movieKey, seriesKey);
  }],
  ['Unknown title fallback is deterministic and does not infer Hindi', () => {
    const metadata = { filename: 'Unknown [Dual Audio].mkv' };
    const first = automatic(metadata, englishDualAudio);
    const second = automatic(metadata, englishDualAudio);
    assert.equal(first.preferredLanguage, null);
    assert.equal(first.selectedIndex, second.selectedIndex);
  }],
  ['Game of Thrones-style dual-audio fixture selects English', () => {
    assert.equal(automatic({
      name: 'Game of Thrones',
      category: 'TV-WEB-Series',
      filename: 'Game.of.Thrones.S01E01.[Dual Audio][Hindi+English].mkv',
    }, englishDualAudio).selectedIndex, 1);
  }],
  ['Breaking Bad-style dual-audio fixture selects English', () => {
    assert.equal(automatic({
      name: 'Breaking Bad',
      category: 'TV-WEB-Series',
      filename: 'Breaking.Bad.S02E03.[Dual Audio][Hindi+English].mkv',
    }, englishDualAudio).selectedIndex, 1);
  }],
  ['Modern modal snapshot preserves exact return fields', () => {
    const snapshot = createModalNavigationSnapshot({
      mediaType: 'tv',
      mediaId: 'game-of-thrones',
      mediaKey: 'series:game-of-thrones:2011',
      selectedSeason: 3,
      selectedEpisode: 6,
      modalScrollTop: 482,
      browsingView: { tab: 'library', searchQuery: 'dragon' },
      browsingScrollTop: 913,
      theme: 'dark',
      historyVersion: 2,
    });
    assert.deepEqual(snapshot, {
      view: 'detail',
      type: 'media',
      source: 'media-modal',
      mediaType: 'tv',
      mediaId: 'game-of-thrones',
      mediaKey: 'series:game-of-thrones:2011',
      key: 'series:game-of-thrones:2011',
      selectedSeason: 3,
      selectedEpisode: 6,
      modalScrollTop: 482,
      browsingView: { tab: 'library', searchQuery: 'dragon' },
      browsingScrollTop: 913,
      theme: 'dark',
      historyVersion: 2,
    });
  }],
];

for (const [name, run] of cases) {
  run();
  process.stdout.write(`ok - ${name}\n`);
}

process.stdout.write(`${cases.length} frontend playback-session tests passed\n`);
