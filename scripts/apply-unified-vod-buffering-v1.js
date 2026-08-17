'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server.js');
let src = fs.readFileSync(file, 'utf8');
const marker = '// SV_UNIFIED_VOD_BUFFERING_V1';

if (src.includes(marker)) {
  console.log('[Unified VOD] buffering v1 already applied');
  process.exit(0);
}

function replaceOnce(from, to, label) {
  const index = src.indexOf(from);
  if (index < 0) throw new Error(`[Unified VOD] target not found: ${label}`);
  src = src.slice(0, index) + to + src.slice(index + from.length);
}

// Standard VOD HLS: give the player an immediate 20-second production burst,
// then keep producing at 1.35x playback speed so the client can accumulate a
// durable forward buffer without FFmpeg racing through an entire movie.
replaceOnce(
  "  ffmpegArgs.push('-re');\n  if (/^https?:\\/\\//i.test(input)) {",
  "  // SV_UNIFIED_VOD_BUFFERING_V1\n  ffmpegArgs.push('-readrate', '1.35', '-readrate_initial_burst', '20');\n  if (/^https?:\\/\\//i.test(input)) {",
  'startMobileHlsSession pacing'
);

// Isolated compatibility HLS uses the same pacing rule.
replaceOnce(
  "  args.push('-re');\n  if (remote) args.push('-rw_timeout', '15000000', '-probesize', '2097152', '-analyzeduration', '2000000');",
  "  args.push('-readrate', '1.35', '-readrate_initial_burst', '20');\n  if (remote) args.push('-rw_timeout', '15000000', '-probesize', '2097152', '-analyzeduration', '2000000');",
  'isolatedMobileHlsArgs pacing'
);

// The isolated compatibility playlist previously retained only six 2-second
// segments. Retain about one minute ahead plus ten older segments for quick
// rewind/short seek without rebuilding the media source.
let listReplacements = 0;
src = src.replace(/'-hls_list_size', '6',\n\s*'-hls_flags', 'delete_segments\+independent_segments\+temp_file',\n\s*'-hls_allow_cache', '0',/g, () => {
  listReplacements += 1;
  return "'-hls_list_size', '30',\n    '-hls_delete_threshold', '10',\n    '-hls_flags', 'delete_segments+independent_segments+temp_file',\n    '-hls_allow_cache', '1',";
});
if (listReplacements !== 1) {
  throw new Error(`[Unified VOD] expected exactly 1 isolated HLS window, changed ${listReplacements}`);
}

const backup = file + '.before-unified-vod-v1.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
fs.writeFileSync(file, src);
console.log('[Unified VOD] buffering v1 applied: 20s initial burst, 1.35x producer, 60s isolated window');
