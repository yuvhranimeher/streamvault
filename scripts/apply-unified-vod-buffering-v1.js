'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server.js');
let src = fs.readFileSync(file, 'utf8');
const original = src;

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

// The current HLS pipeline is paced at exactly real time. That prevents the
// client from ever building a useful forward buffer. Produce an initial burst,
// then continue at 1.35x so HLS.js can hold 30-60 seconds ahead without letting
// FFmpeg run unbounded to the end of the movie.
replaceOnce(
  "  ffmpegArgs.push('-re');\n  if (/^https?:\\/\\//i.test(input)) {",
  "  // SV_UNIFIED_VOD_BUFFERING_V1\n  ffmpegArgs.push('-readrate', '1.35', '-readrate_initial_burst', '20');\n  if (/^https?:\\/\\//i.test(input)) {",
  'startMobileHlsSession pacing'
);

replaceOnce(
  "  args.push('-re');\n  if (remote) args.push('-rw_timeout', '15000000', '-probesize', '2097152', '-analyzeduration', '2000000');",
  "  args.push('-readrate', '1.35', '-readrate_initial_burst', '20');\n  if (remote) args.push('-rw_timeout', '15000000', '-probesize', '2097152', '-analyzeduration', '2000000');",
  'isolatedMobileHlsArgs pacing'
);

// Keep a one-minute live VOD window (2s x 30 segments) instead of only 12s.
// hls_delete_threshold preserves a small back-buffer for quick rewind.
let listReplacements = 0;
src = src.replace(/'-hls_list_size', '6',\n\s*'-hls_flags', 'delete_segments\+independent_segments\+temp_file',\n\s*'-hls_allow_cache', '0',/g, () => {
  listReplacements += 1;
  return "'-hls_list_size', '30',\n    '-hls_delete_threshold', '10',\n    '-hls_flags', 'delete_segments+independent_segments+temp_file',\n    '-hls_allow_cache', '1',";
});
if (listReplacements < 2) {
  throw new Error(`[Unified VOD] expected at least 2 HLS playlist windows, changed ${listReplacements}`);
}

fs.copyFileSync(file, file + '.before-unified-vod-v1.bak');
fs.writeFileSync(file, src);
console.log(`[Unified VOD] buffering v1 applied (${listReplacements} HLS windows)`);
