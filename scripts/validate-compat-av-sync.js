#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function usage() {
  console.error([
    'Usage:',
    '  node scripts/validate-compat-av-sync.js --input <file-or-url> [--audio-map 0:a:0?]',
    '  node scripts/validate-compat-av-sync.js --route-url <stream-url-without-start>',
    '',
    'Options:',
    '  --seek <seconds>          Seek sample start, default 600',
    '  --duration <seconds>      Sample length, default 10',
    '  --threshold-ms <ms>       Max allowed first PTS offset, default 80',
    '  --ffmpeg <path>           ffmpeg binary, default env FFMPEG_BIN or ffmpeg',
    '  --ffprobe <path>          ffprobe binary, default env FFPROBE_BIN or ffprobe',
    '  --work-dir <dir>          Directory for generated samples',
    '  --keep                    Keep generated sample files',
    '',
    'Modes:',
    '  --input validates the compatibility normalization command itself.',
    '  --route-url validates an actual StreamVault compatibility endpoint; start=0 and start=<seek> are added automatically.',
  ].join('\n'));
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    input: '',
    routeUrl: '',
    audioMap: '0:a:0?',
    seek: 600,
    duration: 10,
    thresholdMs: 80,
    ffmpeg: process.env.FFMPEG_BIN || process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobe: process.env.FFPROBE_BIN || process.env.FFPROBE_PATH || 'ffprobe',
    workDir: '',
    keep: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) usage();
      i += 1;
      return argv[i];
    };
    if (arg === '--input') args.input = next();
    else if (arg === '--route-url') args.routeUrl = next();
    else if (arg === '--audio-map') args.audioMap = next();
    else if (arg === '--seek') args.seek = Number(next());
    else if (arg === '--duration') args.duration = Number(next());
    else if (arg === '--threshold-ms') args.thresholdMs = Number(next());
    else if (arg === '--ffmpeg') args.ffmpeg = next();
    else if (arg === '--ffprobe') args.ffprobe = next();
    else if (arg === '--work-dir') args.workDir = next();
    else if (arg === '--keep') args.keep = true;
    else usage();
  }

  if ((!args.input && !args.routeUrl) || (args.input && args.routeUrl)) usage();
  if (!Number.isFinite(args.seek) || args.seek < 0) usage();
  if (!Number.isFinite(args.duration) || args.duration <= 0) usage();
  if (!Number.isFinite(args.thresholdMs) || args.thresholdMs <= 0) usage();
  return args;
}

function run(bin, args, label) {
  const result = spawnSync(bin, args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    const stdout = String(result.stdout || '').trim();
    throw new Error(`${label} failed (${result.status ?? 'signal'}): ${stderr || stdout || 'no output'}`);
  }
  return result.stdout || '';
}

function routeUrlWithStart(value, start) {
  try {
    const parsed = new URL(value);
    parsed.searchParams.set('start', String(Math.floor(start)));
    return parsed.toString();
  } catch {
    const separator = String(value).includes('?') ? '&' : '?';
    return `${value}${separator}start=${Math.floor(start)}`;
  }
}

function makeCompatSample(opts, start, outputFile) {
  const ffmpegArgs = [
    '-hide_banner',
    '-y',
    '-loglevel', 'error',
  ];
  if (start > 0) ffmpegArgs.push('-ss', String(Math.floor(start)));
  ffmpegArgs.push(
    '-fflags', '+genpts',
    '-i', opts.input,
    '-t', String(opts.duration),
    '-map', '0:v:0',
    '-map', opts.audioMap,
    '-sn',
    '-dn',
    '-vf', 'setpts=PTS-STARTPTS',
    '-af', 'asetpts=PTS-STARTPTS,aresample=async=1',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    '-avoid_negative_ts', 'make_zero',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    outputFile
  );
  run(opts.ffmpeg, ffmpegArgs, `ffmpeg compat sample start=${start}`);
}

function makeRouteSample(opts, start, outputFile) {
  const url = routeUrlWithStart(opts.routeUrl, start);
  const ffmpegArgs = [
    '-hide_banner',
    '-y',
    '-loglevel', 'error',
    '-i', url,
    '-t', String(opts.duration),
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-c', 'copy',
    '-f', 'mp4',
    outputFile,
  ];
  run(opts.ffmpeg, ffmpegArgs, `ffmpeg route sample start=${start}`);
}

function firstPacketPts(opts, file, streamSelector) {
  const stdout = run(opts.ffprobe, [
    '-v', 'error',
    '-select_streams', streamSelector,
    '-show_packets',
    '-show_entries', 'packet=pts_time,dts_time',
    '-of', 'json',
    file,
  ], `ffprobe ${streamSelector}`);

  const parsed = JSON.parse(stdout || '{}');
  const packets = Array.isArray(parsed.packets) ? parsed.packets : [];
  for (const packet of packets) {
    const pts = Number(packet.pts_time);
    if (Number.isFinite(pts)) return pts;
    const dts = Number(packet.dts_time);
    if (Number.isFinite(dts)) return dts;
  }
  throw new Error(`No packet PTS found for ${streamSelector} in ${file}`);
}

function validateSample(opts, sampleFile, label) {
  const videoPts = firstPacketPts(opts, sampleFile, 'v:0');
  const audioPts = firstPacketPts(opts, sampleFile, 'a:0');
  const offsetMs = Math.abs(audioPts - videoPts) * 1000;
  const line = `${label}: video=${videoPts.toFixed(6)} audio=${audioPts.toFixed(6)} offset=${offsetMs.toFixed(1)}ms`;
  if (offsetMs > opts.thresholdMs) {
    throw new Error(`${line} exceeds ${opts.thresholdMs}ms`);
  }
  console.log(`PASS ${line}`);
}

function main() {
  const opts = parseArgs(process.argv);
  const workDir = opts.workDir
    ? path.resolve(opts.workDir)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'streamvault-av-sync-'));
  fs.mkdirSync(workDir, { recursive: true });

  const starts = [0, opts.seek];
  const samples = [];
  try {
    for (const start of starts) {
      const sampleFile = path.join(workDir, `compat-start-${Math.floor(start)}.mp4`);
      if (opts.routeUrl) makeRouteSample(opts, start, sampleFile);
      else makeCompatSample(opts, start, sampleFile);
      samples.push(sampleFile);
      validateSample(opts, sampleFile, `start=${start}`);
    }
    console.log(`PASS all samples within ${opts.thresholdMs}ms`);
  } finally {
    if (!opts.keep && !opts.workDir) {
      for (const sample of samples) {
        try { fs.unlinkSync(sample); } catch {}
      }
      try { fs.rmdirSync(workDir); } catch {}
    } else {
      console.log(`Samples kept in ${workDir}`);
    }
  }
}

main();
