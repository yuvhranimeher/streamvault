'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const publicPlayer = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const hostingerPlayer = fs.readFileSync(path.join(root, 'hostinger', 'app-v3.js'), 'utf8');

for (const [name, source] of [['public player', publicPlayer], ['Hostinger player', hostingerPlayer]]) {
  assert.match(source, /manualAudioIndex:null/ , `${name} resets session manual audio state`);
  assert.match(source, /recordManualAudioSelection\(idx,'desktop native audio switch'\)/, `${name} records native manual switches`);
  assert.match(source, /recordManualAudioSelection\(idx,'server audio switch'\)/, `${name} records mapped manual switches`);
  assert.match(source, /switchAudioWithServer\(idx\)/, `${name} keeps server-backed manual switching`);
  assert.match(source, /const logicalIndex=.*availableAudio\[requestedIndex\]/, `${name} preserves the logical stream index for single-track HLS`);
  assert.match(source, /const appliedIndex=hlsInstance.*Number\(hlsInstance\.audioTrack\)/s, `${name} compares HLS manifest indexes without rewriting the logical choice`);
  assert.doesNotMatch(source, /Audio switching is locked while this stream is active/, `${name} must not block manual switching`);
  assert.match(source, /svApplyServerAudioAuthority\(hlsInstance,vid,'video seek completed'\)/, `${name} reapplies the session authority after seeks`);
}

assert.match(server, /selectAudioTrack\(\{/ , 'backend uses the centralized selector');
assert.match(server, /requestedStreamIndex/, 'backend honors absolute manual stream requests');
assert.match(server, /'-map', audioMap \|\| '0:a:0\?'/, 'HLS uses the selected audio map');
assert.match(server, /audioMap: audioSelection\.audioMap/, 'remux paths receive the selected audio map');
assert.match(server, /app\.get\('\/api\/subtitles\/:id'/, 'subtitle routes remain present');
assert.match(server, /res\.writeHead\(206, \{/, 'Range\/206 handling remains present');
assert.match(server, /'\/live-relay\/:channelId\/index\.m3u8'\], svHandleLiveRelayPlaylist/, 'Live TV relay remains present');
assert.match(server, /svServerRejectLiveMediaSource/, 'media/live boundary remains present');

process.stdout.write('audio playback regression boundaries passed\n');
