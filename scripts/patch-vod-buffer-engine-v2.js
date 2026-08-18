'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');
const BACKUP = path.join(ROOT, 'server.js.before-vod-buffer-engine-v2.bak');
const MARKER = 'SV_20260818_VOD_BUFFER_ENGINE_V2';

function fail(message) {
  console.error(`[VOD Buffer Engine] ${message}`);
  process.exit(3);
}

function functionSlice(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return null;
  const next = source.indexOf('\nfunction ', start + 12);
  const appNext = source.indexOf('\napp.', start + 12);
  let end = source.length;
  if (next >= 0) end = Math.min(end, next);
  if (appNext >= 0) end = Math.min(end, appNext);
  return { start, end, text: source.slice(start, end) };
}

function replaceSlice(source, slice, nextText) {
  return source.slice(0, slice.start) + nextText + source.slice(slice.end);
}

function replaceRequired(text, before, after, label) {
  if (!text.includes(before)) fail(`${label}: target not found`);
  return text.replace(before, after);
}

function patchFtpStream(source) {
  const start = source.indexOf("app.get('/api/ftp/stream'");
  const end = source.indexOf("\napp.get('/api/ftp/proxy'", start);
  if (start < 0 || end < 0) fail('FTP stream route not found');
  let block = source.slice(start, end);

  block = block.replaceAll("'-preset', 'ultrafast'", "'-preset', 'veryfast'");
  block = block.replace("'-maxrate', mobilePlayback ? '2000k' : '6M'", "'-maxrate', mobilePlayback ? '2000k' : '4M'");
  block = block.replace("'-bufsize', mobilePlayback ? '4000k' : '12M'", "'-bufsize', mobilePlayback ? '4000k' : '8M'");

  const keyframeNeedle = "'-sc_threshold', '0'";
  if (!block.includes("'expr:gte(t,n_forced*2)'")) {
    block = block.replaceAll(
      keyframeNeedle,
      `${keyframeNeedle},\n        '-force_key_frames', 'expr:gte(t,n_forced*2)'`
    );
  }

  const fragNeedle = "'-flush_packets', '1',\n    '-movflags', 'frag_keyframe+empty_moov+default_base_moof'";
  if (!block.includes("'-frag_duration', '2000000'")) {
    block = replaceRequired(
      block,
      fragNeedle,
      "'-flush_packets', '1',\n    '-frag_duration', '2000000',\n    '-min_frag_duration', '1000000',\n    '-movflags', 'frag_keyframe+empty_moov+default_base_moof'",
      'FTP 2-second MP4 fragments'
    );
  }

  return source.slice(0, start) + block + source.slice(end);
}

function patchLocalTranscode(source) {
  const slice = functionSlice(source, 'transcodeStream');
  if (!slice) fail('local transcodeStream function not found');
  let block = slice.text;

  block = block.replaceAll("'-preset', 'ultrafast'", "'-preset', 'veryfast'");
  block = block.replace("'-maxrate', mobilePlayback ? '2200k' : '6M'", "'-maxrate', mobilePlayback ? '2200k' : '4M'");
  block = block.replace("'-bufsize', mobilePlayback ? '4400k' : '12M'", "'-bufsize', mobilePlayback ? '4400k' : '8M'");

  if (!block.includes("'expr:gte(t,n_forced*2)'")) {
    block = block.replaceAll(
      "'-pix_fmt', 'yuv420p'",
      "'-pix_fmt', 'yuv420p',\n      '-g', '48',\n      '-keyint_min', '48',\n      '-sc_threshold', '0',\n      '-force_key_frames', 'expr:gte(t,n_forced*2)'"
    );
  }

  const fragNeedle = "'-flush_packets', '1',\n    '-movflags', 'frag_keyframe+empty_moov+default_base_moof'";
  if (!block.includes("'-frag_duration', '2000000'")) {
    block = replaceRequired(
      block,
      fragNeedle,
      "'-flush_packets', '1',\n    '-frag_duration', '2000000',\n    '-min_frag_duration', '1000000',\n    '-movflags', 'frag_keyframe+empty_moov+default_base_moof'",
      'local 2-second MP4 fragments'
    );
  }

  return replaceSlice(source, slice, block);
}

function patchHlsGenerator(source, name) {
  const slice = functionSlice(source, name);
  if (!slice) return source;
  let block = slice.text;

  // -re deliberately throttles file/VOD generation to real time. VOD should
  // generate as fast as source + CPU allow so HLS.js can build a forward buffer.
  block = block.replace(/\n\s*args\.push\('-re'\);/g, '');
  block = block.replace(/'\-hls_list_size',\s*'(?:6|8|10|12|15|20)'/g, "'-hls_list_size', '30'");

  return replaceSlice(source, slice, block);
}

if (!fs.existsSync(SERVER)) fail(`server.js not found at ${SERVER}`);
let source = fs.readFileSync(SERVER, 'utf8');
if (source.includes(MARKER)) {
  console.log('[VOD Buffer Engine] already installed');
  process.exit(0);
}

if (!fs.existsSync(BACKUP)) fs.copyFileSync(SERVER, BACKUP);

try {
  source = patchFtpStream(source);
  source = patchLocalTranscode(source);
  source = patchHlsGenerator(source, 'isolatedMobileHlsArgs');
  source = patchHlsGenerator(source, 'mobileHlsArgs');
  source = patchHlsGenerator(source, 'startMobileHlsSession');

  const markerAnchor = "'use strict';";
  if (source.includes(markerAnchor)) {
    source = source.replace(markerAnchor, `${markerAnchor}\n// ${MARKER}: 2s fragments, smaller VOD bitrate, faster-than-realtime HLS buffering.`);
  } else {
    source = `// ${MARKER}\n` + source;
  }

  fs.writeFileSync(SERVER, source, 'utf8');

  const check = spawnSync(process.execPath, ['--check', SERVER], { encoding: 'utf8' });
  if (check.status !== 0) {
    fs.copyFileSync(BACKUP, SERVER);
    fail(`syntax check failed; restored backup\n${check.stderr || check.stdout}`);
  }

  console.log('[VOD Buffer Engine] installed successfully');
  console.log('[VOD Buffer Engine] desktop compatibility bitrate cap: 4M');
  console.log('[VOD Buffer Engine] fMP4 fragment target: 2 seconds');
  console.log('[VOD Buffer Engine] HLS VOD generation: faster than realtime');
  console.log(`[VOD Buffer Engine] backup: ${BACKUP}`);
} catch (error) {
  try { if (fs.existsSync(BACKUP)) fs.copyFileSync(BACKUP, SERVER); } catch {}
  fail(`${error.message}; restored backup`);
}
