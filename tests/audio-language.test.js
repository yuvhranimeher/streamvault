'use strict';

const assert = require('assert/strict');
const {
  determineTitleLanguage,
  normalizeLanguage,
  selectAudioTrack,
} = require('../lib/audio-language');

function track(index, language, options = {}) {
  return {
    index,
    streamIndex: index,
    relativeIndex: options.relativeIndex ?? index,
    language,
    codec: options.codec || 'aac',
    channels: options.channels ?? 2,
    bitrate: options.bitrate ?? 128000,
    ...options,
  };
}

function selected(metadata, streams, options = {}) {
  return selectAudioTrack({
    titleMetadata: metadata,
    audioStreams: streams,
    requestedStreamIndex: options.requestedStreamIndex,
  });
}

const cases = [
  ['English title ignores Hindi first/default', () => {
    const result = selected({ category: 'English Movies' }, [
      track(1, 'hin', { default: true }),
      track(2, 'eng'),
    ]);
    assert.equal(result.selectedStreamIndex, 2);
    assert.equal(result.reason, 'preferred-language:en');
  }],
  ['English title keeps English when it is first', () => {
    assert.equal(selected({ category: 'English Movies' }, [track(4, 'English'), track(8, 'Hindi')]).selectedStreamIndex, 4);
  }],
  ['Hindi title selects Hindi when English is first', () => {
    assert.equal(selected({ category: 'Hindi Movies' }, [track(3, 'eng'), track(7, 'hin')]).selectedStreamIndex, 7);
  }],
  ['English title overrides Hindi source default', () => {
    assert.equal(selected({ language: 'en-US' }, [track(0, 'hi', { default: true }), track(5, 'en')]).selectedStreamIndex, 5);
  }],
  ['Hindi title overrides English source default', () => {
    assert.equal(selected({ original_language: 'hi-IN' }, [track(6, 'en', { default: true }), track(9, 'hi')]).selectedStreamIndex, 9);
  }],
  ['Missing preferred language uses reliable original before default', () => {
    const result = selected({}, [track(10, 'fr', { default: true }), track(12, 'de', { original: true })]);
    assert.equal(result.selectedStreamIndex, 12);
    assert.equal(result.reason, 'reliable-original-track');
  }],
  ['Unknown tracks use deterministic source default', () => {
    const result = selected({}, [track(15, 'und'), track(18, 'unknown', { default: true })]);
    assert.equal(result.selectedStreamIndex, 18);
    assert.equal(result.reason, 'source-default-track');
  }],
  ['Normal English beats English commentary', () => {
    assert.equal(selected({ category: 'English Movies' }, [
      track(20, 'eng', { default: true, title: 'Director Commentary' }),
      track(21, 'eng', { title: 'Main' }),
    ]).selectedStreamIndex, 21);
  }],
  ['Normal English beats English audio description', () => {
    assert.equal(selected({ category: 'English Movies' }, [
      track(22, 'en', { default: true, title: 'English Audio Description' }),
      track(23, 'en', { title: 'English Main' }),
    ]).selectedStreamIndex, 23);
  }],
  ['Multiple English tracks rank main/default deterministically', () => {
    assert.equal(selected({ category: 'English Movies' }, [
      track(30, 'en', { channels: 6 }),
      track(28, 'eng', { default: true, channels: 2 }),
      track(27, 'English', { title: 'Commentary', channels: 8 }),
    ]).selectedStreamIndex, 28);
  }],
  ['Manual stream request wins for the playback session', () => {
    const streams = [track(40, 'en'), track(44, 'hi')];
    const automatic = selected({ category: 'English Movies' }, streams);
    const manual = selected({ category: 'English Movies' }, streams, { requestedStreamIndex: 44 });
    assert.equal(automatic.selectedStreamIndex, 40);
    assert.equal(manual.selectedStreamIndex, 44);
    assert.equal(manual.reason, 'manual-stream-request');
  }],
  ['Episodes resolve their own absolute stream indexes', () => {
    const metadata = { category: 'TV-WEB-Series' };
    assert.equal(selected(metadata, [track(1, 'hi'), track(4, 'en')]).selectedStreamIndex, 4);
    assert.equal(selected(metadata, [track(7, 'en'), track(11, 'hi')]).selectedStreamIndex, 7);
  }],
  ['No audio returns a graceful empty decision', () => {
    const result = selected({ category: 'English Movies' }, []);
    assert.equal(result.selectedTrack, null);
    assert.equal(result.selectedIndex, null);
    assert.equal(result.reason, 'no-playable-audio');
  }],
  ['Hindi season marker overrides TV-WEB English catalog rule', () => {
    const decision = determineTitleLanguage({ category: 'TV-WEB-Series', streamUrl: '/Season 1 (Hindi Language)/episode.mkv' });
    assert.equal(decision.language, 'hi');
  }],
  ['Language normalization handles aliases and variants', () => {
    for (const value of ['en', 'eng', 'English', ' en_US ', 'en-GB', 'English (US)']) assert.equal(normalizeLanguage(value), 'en');
    for (const value of ['hi', 'hin', 'Hindi', ' hi_IN ', 'hindi-India']) assert.equal(normalizeLanguage(value), 'hi');
  }],
  ['Track labels supply language when titles do not', () => {
    assert.equal(selected({ category: 'English Movies' }, [
      track(50, 'und', { title: 'Main Audio', label: 'English' }),
      track(51, 'hi'),
    ]).selectedStreamIndex, 50);
  }],
  ['Unknown metadata is never classified as Hindi', () => {
    for (const value of ['', 'und', 'unknown', 'undefined', null, 'original', 'default', 'mul', 'miscellaneous']) {
      assert.equal(normalizeLanguage(value), null);
    }
  }],
];

for (const [name, run] of cases) {
  run();
  process.stdout.write(`ok - ${name}\n`);
}

process.stdout.write(`${cases.length} audio-language tests passed\n`);
