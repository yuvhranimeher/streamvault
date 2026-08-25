'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TEXT_SUBTITLE_CODECS = new Set([
  'ass', 'ssa', 'subrip', 'srt', 'text', 'mov_text', 'webvtt', 'ttml', 'stpp'
]);
const IMAGE_SUBTITLE_CODECS = new Set([
  'dvd_subtitle', 'dvb_subtitle', 'hdmv_pgs_subtitle', 'pgs', 'xsub'
]);
const AAC_CODECS = new Set(['aac', 'mp4a']);
const MP3_CODECS = new Set(['mp3']);
const OPUS_CODECS = new Set(['opus']);
const VORBIS_CODECS = new Set(['vorbis']);
const H264_CODECS = new Set(['h264', 'avc', 'avc1']);
const HEVC_CODECS = new Set(['hevc', 'h265', 'hev1', 'hvc1']);
const VP8_CODECS = new Set(['vp8']);
const VP9_CODECS = new Set(['vp9']);
const AV1_CODECS = new Set(['av1', 'av01']);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolQuery(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === '1' || value === 'true' || value === 'yes';
}

function cleanCodec(value) {
  return String(value || '').trim().toLowerCase();
}

function sourceExtension(source, filename = '') {
  const candidate = String(filename || source || '').split(/[?#]/)[0];
  return path.extname(candidate).toLowerCase();
}

function containerFamily(info, source, filename) {
  const container = String(info?.container || '').toLowerCase();
  const extension = sourceExtension(source, filename);
  if (extension === '.mkv') return 'mkv';
  if (['.mp4', '.m4v', '.mov'].includes(extension) || /(?:^|,)(?:mov|mp4|m4a|3gp|3g2|mj2)(?:,|$)/.test(container)) return 'mp4';
  if (extension === '.webm' || /(?:^|,)webm(?:,|$)/.test(container)) return 'webm';
  if (extension === '.ogg' || extension === '.ogv' || /(?:^|,)ogg(?:,|$)/.test(container)) return 'ogg';
  if (container.includes('matroska')) return 'mkv';
  return extension.replace(/^\./, '') || container.split(',')[0] || 'unknown';
}

function normalizedAudioTrack(track, index) {
  const channels = Math.max(0, Math.round(finite(track?.channels)));
  const language = String(track?.language || 'und').trim() || 'und';
  const rawTitle = String(track?.title || '').trim();
  return {
    index,
    streamIndex: Number.isFinite(Number(track?.streamIndex ?? track?.index))
      ? Number(track.streamIndex ?? track.index)
      : index,
    relativeIndex: Number.isFinite(Number(track?.relativeIndex)) ? Number(track.relativeIndex) : index,
    language,
    title: rawTitle || `Audio Track ${index + 1}`,
    codec: cleanCodec(track?.codec) || 'unknown',
    channels,
    channelLayout: String(track?.channelLayout || '').trim(),
    default: track?.default === true,
    forced: track?.forced === true,
    bitrate: Math.max(0, finite(track?.bitrate)),
  };
}

function normalizedSubtitleTrack(track, index, urlFactory) {
  const codec = cleanCodec(track?.codec) || 'unknown';
  const text = TEXT_SUBTITLE_CODECS.has(codec);
  const image = IMAGE_SUBTITLE_CODECS.has(codec);
  const language = String(track?.language || track?.lang || 'und').trim() || 'und';
  const title = String(track?.title || track?.label || '').trim() || `Subtitle Track ${index + 1}`;
  const streamIndex = Number.isFinite(Number(track?.streamIndex ?? track?.index))
    ? Number(track.streamIndex ?? track.index)
    : index;
  return {
    index,
    streamIndex,
    relativeIndex: Number.isFinite(Number(track?.relativeIndex)) ? Number(track.relativeIndex) : index,
    language,
    title,
    codec,
    sourceType: track?.sidecar ? 'external' : 'embedded',
    default: track?.default === true,
    forced: track?.forced === true,
    supported: text || (!!track?.sidecar && !image),
    unsupportedReason: image ? 'Image subtitles are not supported in browser text-track mode' : (!text && !track?.sidecar ? 'Subtitle codec cannot be converted to WebVTT' : ''),
    url: (text || (!!track?.sidecar && !image)) ? urlFactory(streamIndex, track) : null,
  };
}

function browserCapabilities(req) {
  return {
    h264: boolQuery(req.query.h264, true),
    hevc: boolQuery(req.query.hevc, false),
    vp8: boolQuery(req.query.vp8, true),
    vp9: boolQuery(req.query.vp9, true),
    av1: boolQuery(req.query.av1, false),
    aac: boolQuery(req.query.aac, true),
    mp3: boolQuery(req.query.mp3, true),
    opus: boolQuery(req.query.opus, true),
    vorbis: boolQuery(req.query.vorbis, true),
  };
}

function browserCanDecodeVideo(codec, caps) {
  if (H264_CODECS.has(codec)) return caps.h264;
  if (HEVC_CODECS.has(codec)) return caps.hevc;
  if (VP8_CODECS.has(codec)) return caps.vp8;
  if (VP9_CODECS.has(codec)) return caps.vp9;
  if (AV1_CODECS.has(codec)) return caps.av1;
  return false;
}

function browserCanDecodeAudio(codec, caps) {
  if (!codec || codec === 'unknown') return true;
  if (AAC_CODECS.has(codec)) return caps.aac;
  if (MP3_CODECS.has(codec)) return caps.mp3;
  if (OPUS_CODECS.has(codec)) return caps.opus;
  if (VORBIS_CODECS.has(codec)) return caps.vorbis;
  return false;
}

function directContainerSupports(container, videoCodec, audioCodec) {
  if (container === 'mp4') {
    return (H264_CODECS.has(videoCodec) || HEVC_CODECS.has(videoCodec) || AV1_CODECS.has(videoCodec))
      && (!audioCodec || AAC_CODECS.has(audioCodec) || MP3_CODECS.has(audioCodec));
  }
  if (container === 'webm') {
    return (VP8_CODECS.has(videoCodec) || VP9_CODECS.has(videoCodec) || AV1_CODECS.has(videoCodec))
      && (!audioCodec || OPUS_CODECS.has(audioCodec) || VORBIS_CODECS.has(audioCodec));
  }
  if (container === 'ogg') return VP8_CODECS.has(videoCodec) && (!audioCodec || VORBIS_CODECS.has(audioCodec));
  return false;
}

function playbackDecision(info, source, filename, caps) {
  const container = containerFamily(info, source, filename);
  const videoCodec = cleanCodec(info?.videoCodec);
  const audioTracks = (Array.isArray(info?.audioTracks) ? info.audioTracks : []).map(normalizedAudioTrack);
  const firstAudioCodec = audioTracks[0]?.codec || '';
  const videoDecodable = browserCanDecodeVideo(videoCodec, caps);
  const audioDecodable = browserCanDecodeAudio(firstAudioCodec, caps);
  const directContainer = directContainerSupports(container, videoCodec, firstAudioCodec);
  const reliableDirectTrackModel = audioTracks.length <= 1;
  const direct = directContainer && videoDecodable && audioDecodable && reliableDirectTrackModel;

  if (direct) {
    return {
      mode: 'direct',
      strategy: 'direct',
      reason: 'Browser-compatible container and codecs',
      container,
      videoCodec,
      videoAction: 'copy',
      audioAction: 'copy',
      audioTracks,
    };
  }

  const videoAction = videoDecodable && H264_CODECS.has(videoCodec)
    ? 'copy'
    : (videoDecodable && caps.hevc && HEVC_CODECS.has(videoCodec) ? 'copy' : 'transcode-h264');
  const audioAction = audioTracks.every(track => browserCanDecodeAudio(track.codec, caps) && AAC_CODECS.has(track.codec))
    ? 'copy'
    : 'transcode-aac';
  let strategy = 'remux';
  if (videoAction !== 'copy') strategy = 'video-transcode';
  else if (audioAction !== 'copy') strategy = 'audio-transcode';
  else if (audioTracks.length > 1) strategy = 'alternate-audio-remux';
  return {
    mode: 'hls',
    strategy,
    reason: audioTracks.length > 1
      ? 'Compatibility HLS provides source-preserving alternate audio tracks'
      : (videoAction === 'copy' ? 'Container remux is required' : 'Video codec is not supported by this browser'),
    container,
    videoCodec,
    videoAction,
    audioAction,
    audioTracks,
  };
}

function sha1(value, length = 40) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, length);
}

function ensureInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function safeSendFile(res, filePath, contentType, cacheControl) {
  let stat;
  try {
    stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) return false;
  } catch {
    return false;
  }
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Access-Control-Allow-Origin', '*');
  const stream = fs.createReadStream(filePath);
  res.on('close', () => stream.destroy());
  stream.on('error', () => { if (!res.headersSent) res.status(500).end(); });
  stream.pipe(res);
  return true;
}

function installPlaybackCapability(options) {
  const {
    app,
    cacheDir,
    ffmpegBin = 'ffmpeg',
    getMediaInfo,
    resolveLocal,
    resolveRemote,
    getLocalSidecars = () => [],
    getRemoteSidecars = async () => [],
    isRemoteSidecarAllowed = () => false,
  } = options || {};
  if (!app || !cacheDir || !getMediaInfo || !resolveLocal || !resolveRemote) {
    throw new Error('Playback capability installer is missing required dependencies');
  }

  const hlsRoot = path.join(cacheDir, 'hls');
  const subtitleRoot = path.join(cacheDir, 'subtitles');
  fs.mkdirSync(hlsRoot, { recursive: true });
  fs.mkdirSync(subtitleRoot, { recursive: true });

  const sessions = new Map();
  const subtitleJobs = new Map();
  const activeWorkers = new Set();
  const intentionallyStoppedWorkers = new WeakSet();
  const maxWorkers = Math.max(1, finite(process.env.PLAYBACK_HLS_MAX_WORKERS, 2));
  const idleMs = Math.max(120000, finite(process.env.PLAYBACK_HLS_IDLE_MS, 5 * 60 * 1000));
  const segmentSeconds = Math.max(3, Math.min(6, finite(process.env.PLAYBACK_HLS_SEGMENT_SECONDS, 4)));

  function sourceState(source) {
    if (source.remote) return `remote:${source.input}`;
    try {
      const stat = fs.statSync(source.input);
      return `local:${source.input}:${stat.size}:${stat.mtimeMs}`;
    } catch {
      return `local:${source.input}:missing`;
    }
  }

  function sessionFor(source, info, decision) {
    const profile = decision.videoAction === 'copy'
      ? `copy-${decision.videoCodec || 'unknown'}`
      : 'h264-yuv420p';
    const audioProfile = decision.audioTracks
      .map(track => `${track.streamIndex}:${track.codec}:${AAC_CODECS.has(track.codec) ? 'copy' : 'aac'}:${track.channels}`)
      .join(',');
    const mediaFingerprint = [
      finite(info?.fileSize), finite(info?.duration), decision.videoCodec,
      finite(info?.width), finite(info?.height), audioProfile
    ].join(':');
    const key = sha1(`playback-v2|${sourceState(source)}|${mediaFingerprint}|${profile}|fmp4|${segmentSeconds}`, 28);
    const existing = sessions.get(key);
    if (existing) {
      existing.lastAccess = Date.now();
      return existing;
    }
    const dir = path.join(hlsRoot, key);
    const session = {
      key,
      dir,
      source,
      info,
      decision,
      process: null,
      state: fs.existsSync(path.join(dir, 'complete.json')) ? 'complete' : 'idle',
      error: '',
      createdAt: Date.now(),
      lastAccess: Date.now(),
      startedAt: 0,
      readyAt: 0,
    };
    sessions.set(key, session);
    return session;
  }

  function masterPlaylist(session) {
    const tracks = session.decision.audioTracks;
    const defaultIndex = Math.max(0, tracks.findIndex(track => track.default));
    const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS'];
    for (const track of tracks) {
      const index = track.index;
      const language = String(track.language || 'und').replace(/["\r\n]/g, '');
      const title = String(track.title || `Audio Track ${index + 1}`).replace(/["\r\n]/g, "'");
      lines.push(`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${title}",LANGUAGE="${language}",AUTOSELECT=YES,DEFAULT=${index === defaultIndex ? 'YES' : 'NO'},URI="audio-${index}/index.m3u8"`);
    }
    const bandwidth = Math.max(1000000, finite(session.info?.bitrate, 6000000));
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${Math.round(bandwidth)}${tracks.length ? ',AUDIO="audio"' : ''}`);
    lines.push('video/index.m3u8', '');
    return lines.join('\n');
  }

  function outputHlsArgs(kindDir, map, codecArgs, mediaType) {
    const initPath = path.join(kindDir, 'init.mp4');
    const segmentPattern = path.join(kindDir, 'seg_%06d.m4s');
    const playlistPath = path.join(kindDir, 'index.m3u8');
    const args = ['-map', map];
    if (mediaType === 'video') args.push('-an', '-sn', '-dn');
    else args.push('-vn', '-sn', '-dn');
    args.push(
      ...codecArgs,
      '-f', 'hls',
      '-hls_segment_type', 'fmp4',
      '-hls_fmp4_init_filename', initPath,
      '-hls_time', String(segmentSeconds),
      '-hls_list_size', '0',
      '-hls_playlist_type', 'event',
      '-hls_flags', 'independent_segments+temp_file',
      '-hls_segment_filename', segmentPattern,
      playlistPath
    );
    return args;
  }

  function buildFfmpegArgs(session) {
    const inputArgs = ['-hide_banner', '-loglevel', 'warning', '-nostdin'];
    if (session.source.remote) inputArgs.push('-rw_timeout', '15000000', '-probesize', '2097152', '-analyzeduration', '2000000');
    inputArgs.push('-fflags', '+genpts', '-i', session.source.input);

    const videoDir = path.join(session.dir, 'video');
    fs.mkdirSync(videoDir, { recursive: true });
    const videoCodecArgs = session.decision.videoAction === 'copy'
      ? ['-c:v', 'copy']
      : [
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
          '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
          '-g', String(Math.round(segmentSeconds * 24)),
          '-keyint_min', String(Math.round(segmentSeconds * 24)),
          '-sc_threshold', '0'
        ];
    const args = [...inputArgs, ...outputHlsArgs(videoDir, '0:v:0', videoCodecArgs, 'video')];

    for (const track of session.decision.audioTracks) {
      const audioDir = path.join(session.dir, `audio-${track.index}`);
      fs.mkdirSync(audioDir, { recursive: true });
      const codecArgs = AAC_CODECS.has(track.codec)
        ? ['-c:a', 'copy']
        : ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];
      args.push(...outputHlsArgs(audioDir, `0:${track.streamIndex}`, codecArgs, 'audio'));
    }
    return args;
  }

  function writeSessionMetadata(session) {
    const data = {
      key: session.key,
      completedAt: new Date().toISOString(),
      strategy: session.decision.strategy,
      videoAction: session.decision.videoAction,
      audioAction: session.decision.audioAction,
      sourceState: sourceState(session.source),
    };
    fs.writeFileSync(path.join(session.dir, 'complete.json'), JSON.stringify(data, null, 2));
  }

  function startSession(session) {
    session.lastAccess = Date.now();
    if (session.state === 'complete') return session;
    if (session.process && session.process.exitCode === null) return session;
    if (activeWorkers.size >= maxWorkers) {
      const error = new Error('Compatibility stream capacity is currently busy');
      error.code = 'PLAYBACK_BUSY';
      throw error;
    }

    fs.rmSync(session.dir, { recursive: true, force: true });
    fs.mkdirSync(session.dir, { recursive: true });
    const args = buildFfmpegArgs(session);
    session.state = 'preparing';
    session.error = '';
    session.startedAt = Date.now();
    const child = spawn(ffmpegBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    session.process = child;
    activeWorkers.add(child);
    let stderr = '';
    console.log(`[Playback v2 HLS] start key=${session.key} strategy=${session.decision.strategy} source=${session.source.label}`);
    child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-5000); });
    child.on('error', error => {
      if (intentionallyStoppedWorkers.has(child)) return;
      session.error = error.message;
      session.state = 'failed';
    });
    child.on('close', code => {
      activeWorkers.delete(child);
      if (intentionallyStoppedWorkers.has(child)) {
        intentionallyStoppedWorkers.delete(child);
        if (session.process === child) session.process = null;
        session.error = '';
        session.state = 'idle';
        try { fs.rmSync(session.dir, { recursive: true, force: true }); } catch {}
        console.log(`[Playback v2 HLS] stopped idle partial session key=${session.key}`);
        return;
      }
      if (session.process === child) session.process = null;
      if (code === 0) {
        session.state = 'complete';
        session.lastAccess = Date.now();
        try { writeSessionMetadata(session); } catch (error) { console.warn('[Playback v2 HLS] metadata write failed:', error.message); }
      } else if (session.state !== 'stopped') {
        session.error = session.error || `FFmpeg exited with code ${code}: ${stderr.slice(-1200)}`;
        session.state = 'failed';
        console.error(`[Playback v2 HLS] failed key=${session.key}: ${session.error}`);
      }
    });
    return session;
  }

  function playlistReady(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.includes('#EXT-X-MAP') && /seg_\d+\.m4s/.test(content);
    } catch {
      return false;
    }
  }

  function waitForFile(session, filePath, predicate, timeoutMs) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        session.lastAccess = Date.now();
        if (session.error && session.state === 'failed') return reject(new Error(session.error));
        try {
          if (fs.existsSync(filePath) && (!predicate || predicate(filePath))) return resolve(filePath);
        } catch {}
        if (Date.now() - started >= timeoutMs) return reject(new Error('Compatibility stream is not ready yet'));
        setTimeout(check, 150);
      };
      check();
    });
  }

  function rewriteMediaPlaylist(content) {
    return String(content)
      .replace(/#EXT-X-MAP:URI="[^"]*[\\/]([^"\\/]+)"/g, '#EXT-X-MAP:URI="$1"')
      .split(/\r?\n/)
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        return path.basename(trimmed.replace(/\\/g, '/'));
      })
      .join('\n');
  }

  function sessionKindDir(session, kind) {
    if (kind === 'video') return path.join(session.dir, 'video');
    if (/^audio-\d+$/.test(kind)) return path.join(session.dir, kind);
    return null;
  }

  async function capabilityFor(req, source) {
    const info = await getMediaInfo(source.input);
    const caps = browserCapabilities(req);
    const decision = playbackDecision(info, source.input, source.filename, caps);
    const directUrl = source.directUrl;
    let hlsUrl = null;
    let session = null;
    if (decision.mode === 'hls') {
      session = sessionFor(source, info, decision);
      hlsUrl = `/api/playback-hls/${session.key}/master.m3u8`;
    }

    const embedded = (Array.isArray(info.subtitleTracks) ? info.subtitleTracks : []).map((track, index) =>
      normalizedSubtitleTrack(track, index, streamIndex => source.remote
        ? `/api/playback/remote/subtitles/${streamIndex}.vtt?url=${encodeURIComponent(source.input)}`
        : `/api/playback/${encodeURIComponent(source.id)}/subtitles/${streamIndex}.vtt`)
    );
    const sidecars = source.remote
      ? (req.query.sidecars === '1' ? await getRemoteSidecars(source.input, req).catch(() => []) : [])
      : getLocalSidecars(source);
    const external = (Array.isArray(sidecars) ? sidecars : []).map((track, index) =>
      normalizedSubtitleTrack({ ...track, sidecar: true, codec: cleanCodec(track.codec || track.ext).replace(/^\./, '') }, embedded.length + index, (_streamIndex, item) => {
        if (source.remote) {
          const sidecarUrl = item.src || item.url || item.filePath || '';
          return `/api/playback/remote/subtitles/sidecar/${index}.vtt?url=${encodeURIComponent(source.input)}&sidecar=${encodeURIComponent(sidecarUrl)}`;
        }
        return `/api/playback/${encodeURIComponent(source.id)}/subtitles/sidecar/${index}.vtt`;
      })
    );

    return {
      ok: true,
      id: source.id,
      title: source.label,
      mode: decision.mode,
      strategy: decision.strategy,
      reason: decision.reason,
      container: decision.container,
      videoCodec: decision.videoCodec || 'unknown',
      width: finite(info.width),
      height: finite(info.height),
      duration: finite(info.duration),
      audioTracks: decision.audioTracks,
      subtitleTracks: [...embedded, ...external],
      directUrl: decision.mode === 'direct' ? directUrl : null,
      originalUrl: directUrl,
      hlsUrl,
      cacheKey: session?.key || null,
      conversion: {
        video: decision.videoAction,
        audio: decision.audioAction,
        subtitles: 'independent-webvtt',
      },
    };
  }

  function jsonFailure(res, error) {
    const status = error?.status || (error?.code === 'PLAYBACK_BUSY' ? 503 : 502);
    const code = error?.code || (status === 404 ? 'SOURCE_MISSING' : 'PLAYBACK_PREPARATION_FAILED');
    return res.status(status).json({ ok: false, code, error: error?.publicMessage || error?.message || 'Playback preparation failed' });
  }

  app.get('/api/playback/status', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      sessions: [...sessions.values()].map(session => ({
        key: session.key,
        state: session.state,
        strategy: session.decision.strategy,
        createdAt: session.createdAt,
        startedAt: session.startedAt,
        readyAt: session.readyAt,
        lastAccess: session.lastAccess,
        running: !!session.process,
        error: session.error || '',
      })),
      activeWorkers: activeWorkers.size,
      subtitleJobs: subtitleJobs.size,
    });
  });

  app.get('/api/playback/remote', async (req, res) => {
    try {
      const source = resolveRemote(String(req.query.url || ''));
      if (!source) {
        const error = new Error('Remote media source is not in the StreamVault catalog');
        error.status = 404;
        error.code = 'SOURCE_MISSING';
        throw error;
      }
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.json(await capabilityFor(req, { ...source, remote: true }));
    } catch (error) {
      console.error('[Playback v2] remote capability failed:', error.message);
      jsonFailure(res, error);
    }
  });

  app.get('/api/playback/:id', async (req, res) => {
    try {
      const source = resolveLocal(req.params.id);
      if (!source) {
        const error = new Error('Source file missing');
        error.status = 404;
        error.code = 'SOURCE_MISSING';
        throw error;
      }
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.json(await capabilityFor(req, { ...source, remote: false, id: req.params.id }));
    } catch (error) {
      console.error('[Playback v2] local capability failed:', error.message);
      jsonFailure(res, error);
    }
  });

  app.get('/api/playback-hls/:key/master.m3u8', (req, res) => {
    const session = sessions.get(req.params.key);
    if (!session) return res.status(404).send('#EXTM3U\n');
    try {
      startSession(session);
      session.lastAccess = Date.now();
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(masterPlaylist(session));
    } catch (error) {
      console.error('[Playback v2 HLS] master failed:', error.message);
      res.status(error.code === 'PLAYBACK_BUSY' ? 503 : 500).send('#EXTM3U\n');
    }
  });

  app.get('/api/playback-hls/:key/:kind/:file', async (req, res) => {
    const session = sessions.get(req.params.key);
    if (!session) return res.status(404).end();
    const kindDir = sessionKindDir(session, req.params.kind);
    if (!kindDir) return res.status(404).end();
    const file = path.basename(req.params.file);
    if (!/^(?:index\.m3u8|init\.mp4|seg_\d+\.m4s)$/.test(file)) return res.status(404).end();
    const filePath = path.join(kindDir, file);
    if (!ensureInside(session.dir, filePath)) return res.status(404).end();
    try {
      startSession(session);
      session.lastAccess = Date.now();
      if (file === 'index.m3u8') {
        await waitForFile(session, filePath, playlistReady, 30000);
        const content = rewriteMediaPlaylist(fs.readFileSync(filePath, 'utf8'));
        if (!session.readyAt) session.readyAt = Date.now();
        if (session.state === 'preparing') session.state = 'ready';
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(content);
      }
      await waitForFile(session, filePath, candidate => fs.statSync(candidate).size > 0, 10000);
      const type = file === 'init.mp4' ? 'video/mp4' : 'video/iso.segment';
      if (!safeSendFile(res, filePath, type, 'public, max-age=31536000, immutable')) return res.status(404).end();
    } catch (error) {
      console.error(`[Playback v2 HLS] asset failed key=${session.key} file=${file}:`, error.message);
      if (!res.headersSent) res.status(503).end();
    }
  });

  function subtitleCachePath(source, identity) {
    return path.join(subtitleRoot, `${sha1(`${sourceState(source)}|${identity}`)}.vtt`);
  }

  function runSubtitleJob(source, identity, ffmpegArgs) {
    const finalPath = subtitleCachePath(source, identity);
    try {
      if (fs.statSync(finalPath).size > 6) return Promise.resolve(finalPath);
    } catch {}
    const existing = subtitleJobs.get(finalPath);
    if (existing) return existing;
    const tempPath = `${finalPath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const promise = new Promise((resolve, reject) => {
      const args = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
      if (source.remote) args.push('-rw_timeout', '15000000', '-probesize', '2097152', '-analyzeduration', '2000000');
      args.push(...ffmpegArgs, '-c:s', 'webvtt', '-f', 'webvtt', tempPath);
      const child = spawn(ffmpegBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill('SIGKILL'); } catch {}
        reject(new Error('Subtitle conversion timed out'));
      }, 120000);
      child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-3000); });
      child.on('error', error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', code => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          if (code !== 0) throw new Error(`Subtitle conversion failed: ${stderr.slice(-800)}`);
          const body = fs.readFileSync(tempPath, 'utf8');
          if (!body.startsWith('WEBVTT')) throw new Error('Subtitle conversion did not produce WebVTT');
          fs.renameSync(tempPath, finalPath);
          resolve(finalPath);
        } catch (error) {
          reject(error);
        }
      });
    }).finally(() => {
      subtitleJobs.delete(finalPath);
      try { if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true }); } catch {}
    });
    subtitleJobs.set(finalPath, promise);
    return promise;
  }

  async function sendSubtitle(res, job) {
    try {
      const filePath = await job;
      if (!safeSendFile(res, filePath, 'text/vtt; charset=utf-8', 'public, max-age=31536000, immutable')) return res.status(404).end();
    } catch (error) {
      console.error('[Playback v2 Subtitle] failed:', error.message);
      if (!res.headersSent) res.status(422).json({ ok: false, code: 'SUBTITLE_UNAVAILABLE', error: 'Subtitle track unavailable' });
    }
  }

  app.get('/api/playback/remote/subtitles/sidecar/:index.vtt', async (req, res) => {
    const source = resolveRemote(String(req.query.url || ''));
    if (!source) return res.status(404).end();
    let sidecar;
    try {
      sidecar = new URL(String(req.query.sidecar || ''), source.input);
      const mediaUrl = new URL(source.input);
      if (sidecar.hostname !== mediaUrl.hostname || sidecar.protocol !== mediaUrl.protocol || !isRemoteSidecarAllowed(source.input, sidecar.href)) return res.status(403).end();
    } catch {
      return res.status(400).end();
    }
    const remoteSource = { ...source, remote: true };
    sendSubtitle(res, runSubtitleJob(remoteSource, `sidecar:${sidecar.href}`, ['-i', sidecar.href, '-map', '0:s:0?']));
  });

  app.get('/api/playback/remote/subtitles/:streamIndex.vtt', (req, res) => {
    const source = resolveRemote(String(req.query.url || ''));
    const streamIndex = Number(req.params.streamIndex);
    if (!source || !Number.isInteger(streamIndex) || streamIndex < 0) return res.status(404).end();
    const remoteSource = { ...source, remote: true };
    sendSubtitle(res, runSubtitleJob(remoteSource, `embedded:${streamIndex}`, ['-i', source.input, '-map', `0:${streamIndex}?`, '-vn', '-an']));
  });

  app.get('/api/playback/:id/subtitles/sidecar/:index.vtt', (req, res) => {
    const source = resolveLocal(req.params.id);
    const index = Number(req.params.index);
    if (!source || !Number.isInteger(index) || index < 0) return res.status(404).end();
    const sidecars = getLocalSidecars(source);
    const track = sidecars[index];
    if (!track?.filePath || !fs.existsSync(track.filePath)) return res.status(404).end();
    const localSource = { ...source, remote: false };
    sendSubtitle(res, runSubtitleJob(localSource, `sidecar:${track.filePath}`, ['-i', track.filePath, '-map', '0:s:0?']));
  });

  app.get('/api/playback/:id/subtitles/:streamIndex.vtt', (req, res) => {
    const source = resolveLocal(req.params.id);
    const streamIndex = Number(req.params.streamIndex);
    if (!source || !Number.isInteger(streamIndex) || streamIndex < 0) return res.status(404).end();
    const localSource = { ...source, remote: false };
    sendSubtitle(res, runSubtitleJob(localSource, `embedded:${streamIndex}`, ['-i', source.input, '-map', `0:${streamIndex}?`, '-vn', '-an']));
  });

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const session of sessions.values()) {
      if (!session.process || session.state === 'stopped' || now - session.lastAccess <= idleMs) continue;
      const child = session.process;
      session.state = 'stopped';
      intentionallyStoppedWorkers.add(child);
      try { child.kill('SIGKILL'); } catch {}
    }
  }, 30000);
  cleanupTimer.unref?.();

  const stopWorkers = () => {
    clearInterval(cleanupTimer);
    for (const session of sessions.values()) {
      try {
        if (session.process) {
          intentionallyStoppedWorkers.add(session.process);
          session.process.kill('SIGKILL');
        }
      } catch {}
    }
  };
  process.once('SIGINT', stopWorkers);
  process.once('SIGTERM', stopWorkers);

  return { sessions, subtitleJobs, stopWorkers };
}

module.exports = {
  installPlaybackCapability,
  playbackDecision,
  normalizedAudioTrack,
  normalizedSubtitleTrack,
};
