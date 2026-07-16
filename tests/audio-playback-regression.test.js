'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const publicPlayer = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const hostingerPlayer = fs.readFileSync(path.join(root, 'hostinger', 'app-v3.js'), 'utf8');
const publicIndex = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const hostingerIndex = fs.readFileSync(path.join(root, 'hostinger', 'index.html'), 'utf8');
const playbackSession = fs.readFileSync(path.join(root, 'lib', 'frontend-playback-session.js'), 'utf8');

for (const [name, source] of [['public player', publicPlayer], ['Hostinger player', hostingerPlayer]]) {
  assert.match(source, /manualAudioIndex:null/ , `${name} resets session manual audio state`);
  assert.match(source, /sessionKey:''/, `${name} carries an explicit audio session key`);
  assert.match(source, /svAudioSession\.begin\(context\)/, `${name} begins a scoped audio session for each media item`);
  assert.match(source, /svPlaybackContextForEpisode\(show,season,epIdx,ep\)/, `${name} keys series playback by episode`);
  assert.match(source, /switchToEpisode[\s\S]*svPlaybackContextForEpisode\(show,season,epIdx,ep\)/, `${name} resets audio authority when switching episodes inside the player`);
  assert.match(source, /switchToSeries[\s\S]*svPlaybackContextForEpisode\(show,firstSeason,0,firstEp\)/, `${name} resets audio authority when switching series inside the player`);
  assert.match(source, /svPlaybackContextForMovie\(movie\)/, `${name} keys movie playback independently`);
  assert.match(source, /preferredAudioLanguage/, `${name} preserves known title-language authority`);
  assert.match(source, /svPreferredAudioDecision\(availableAudio/, `${name} applies deterministic preferred-language selection`);
  assert.match(source, /recordManualAudioSelection\(idx,'desktop native audio switch'\)/, `${name} records native manual switches`);
  assert.match(source, /recordManualAudioSelection\(idx,'server audio switch'\)/, `${name} records mapped manual switches`);
  assert.match(source, /switchAudioWithServer\(idx\)/, `${name} keeps server-backed manual switching`);
  assert(
    /const logicalDecision=svPreferredAudioDecision\(availableAudio/.test(source)
      || /function svApplyActiveAudioAuthority\(/.test(source),
    `${name} preserves the logical stream choice across HLS manifests`
  );
  assert(
    /if\(tracks\.length === 1\)nextIndex=0/.test(source)
      || /if\(tracks\.length === 1\)return 0/.test(source),
    `${name} maps a selected logical stream onto single-track HLS output`
  );
  assert(
    /const appliedIndex=hlsInstance.*Number\(hlsInstance\.audioTrack\)/s.test(source)
      || /if\(previous !== next\)hls\.audioTrack=next/.test(source),
    `${name} compares HLS manifest indexes without rewriting the logical choice`
  );
  assert.doesNotMatch(source, /Audio switching is locked while this stream is active/, `${name} must not block manual switching`);
  assert.match(source, /svApplyServerAudioAuthority\(hlsInstance,vid,'video seek completed'\)/, `${name} reapplies the session authority after seeks`);
  assert.doesNotMatch(source, /localStorage\.(?:setItem|getItem)\([^)]*audio/i, `${name} must not persist a global audio index`);
}

for (const [name, html, scriptName] of [
  ['public frontend', publicIndex, 'app.js'],
  ['Hostinger frontend', hostingerIndex, 'app-v3.js'],
]) {
  const sessionPos = html.indexOf('/frontend-playback-session.js');
  const playerPos = html.indexOf(`/${scriptName}`);
  assert(sessionPos >= 0, `${name} must load the shared playback-session asset`);
  assert(sessionPos < playerPos, `${name} must load playback-session logic before the player`);
}

assert.match(playbackSession, /createMediaSessionKey/, 'shared frontend logic exposes stable media session keys');
assert.match(playbackSession, /manual-session-selection/, 'shared frontend logic scopes manual authority to the active session');
assert.match(playbackSession, /catalog-category:english/, 'shared frontend logic recognizes trusted English catalog metadata');
assert.match(playbackSession, /catalog-category:hindi/, 'shared frontend logic recognizes trusted Hindi catalog metadata');
assert.doesNotMatch(playbackSession, /dual[^]*return \{ language: 'hi'/i, 'Dual Audio must never imply Hindi preference');

assert.match(server, /selectAudioTrack\(\{/ , 'backend uses the centralized selector');
assert.match(server, /requestedStreamIndex/, 'backend honors absolute manual stream requests');
assert.match(server, /explicit-absolute-stream-request/, 'backend keeps an explicit FTP absolute stream authoritative');
assert.match(server, /'-map', audioMap \|\| '0:a:0\?'/, 'HLS uses the selected audio map');
assert.match(server, /audioMap: audioSelection\.audioMap/, 'remux paths receive the selected audio map');
assert.match(server, /app\.get\('\/api\/subtitles\/:id'/, 'subtitle routes remain present');
assert.match(server, /res\.writeHead\(206, \{/, 'Range\/206 handling remains present');
assert.match(server, /'\/live-relay\/:channelId\/index\.m3u8'\], svHandleLiveRelayPlaylist/, 'Live TV relay remains present');
assert.match(server, /svServerRejectLiveMediaSource/, 'media/live boundary remains present');

process.stdout.write('audio playback regression boundaries passed\n');
