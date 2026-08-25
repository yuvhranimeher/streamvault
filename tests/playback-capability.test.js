'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  playbackDecision,
  normalizedAudioTrack,
  normalizedSubtitleTrack,
} = require('../lib/playback-capability');

const chrome = {
  h264: true,
  hevc: false,
  vp8: true,
  vp9: true,
  av1: true,
  aac: true,
  mp3: true,
  opus: true,
  vorbis: true,
};

test('direct plays compatible single-audio H.264 MP4', () => {
  const decision = playbackDecision({
    container: 'mov,mp4,m4a,3gp,3g2,mj2',
    videoCodec: 'h264',
    audioTracks: [{ index: 1, codec: 'aac', language: 'eng', channels: 2 }],
  }, '/movie.mp4', 'movie.mp4', chrome);
  assert.equal(decision.mode, 'direct');
  assert.equal(decision.strategy, 'direct');
});

test('uses one alternate-audio HLS session for multi-audio H.264 MKV', () => {
  const decision = playbackDecision({
    container: 'matroska,webm',
    videoCodec: 'h264',
    audioTracks: [
      { index: 1, codec: 'aac', language: 'eng' },
      { index: 2, codec: 'aac', language: 'jpn' },
    ],
  }, '/movie.mkv', 'movie.mkv', chrome);
  assert.equal(decision.mode, 'hls');
  assert.equal(decision.strategy, 'alternate-audio-remux');
  assert.equal(decision.videoAction, 'copy');
  assert.equal(decision.audioAction, 'copy');
});

test('copies compatible video and converts only DTS audio', () => {
  const decision = playbackDecision({
    container: 'matroska,webm',
    videoCodec: 'h264',
    audioTracks: [{ index: 1, codec: 'dts', language: 'eng', channels: 6 }],
  }, '/movie.mkv', 'movie.mkv', chrome);
  assert.equal(decision.strategy, 'audio-transcode');
  assert.equal(decision.videoAction, 'copy');
  assert.equal(decision.audioAction, 'transcode-aac');
});

test('transcodes HEVC only when the requesting browser cannot decode it', () => {
  const media = {
    container: 'mov,mp4,m4a,3gp,3g2,mj2',
    videoCodec: 'hevc',
    audioTracks: [{ index: 1, codec: 'aac' }],
  };
  assert.equal(playbackDecision(media, '/movie.mp4', 'movie.mp4', chrome).videoAction, 'transcode-h264');
  assert.equal(playbackDecision(media, '/movie.mp4', 'movie.mp4', { ...chrome, hevc: true }).mode, 'direct');
});

test('track metadata always has useful labels and bitmap subtitles are explicit', () => {
  assert.equal(normalizedAudioTrack({}, 0).title, 'Audio Track 1');
  const bitmap = normalizedSubtitleTrack({ codec: 'hdmv_pgs_subtitle' }, 0, () => '/unused');
  assert.equal(bitmap.supported, false);
  assert.equal(bitmap.url, null);
  assert.match(bitmap.unsupportedReason, /Image subtitles/);
});
