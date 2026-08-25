const fs = require('fs');

function patch(file, edits){
  let text = fs.readFileSync(file,'utf8').replace(/\r\n/g,"\n");
  fs.copyFileSync(file, file + ".bak-playback-hotfix-" + Date.now());

  for(const [find, repl] of edits){
    if(!text.includes(find)){
      throw new Error("Pattern not found in " + file + ":\n" + find.slice(0,180));
    }
    text = text.replace(find, repl);
  }

  fs.writeFileSync(file, text, 'utf8');
  console.log("patched", file);
}

patch("server.js", [
[`const MOBILE_HLS_IDLE_MS = Number(process.env.MOBILE_HLS_IDLE_MS || 45000);`,
`const MOBILE_HLS_IDLE_MS = Number(process.env.MOBILE_HLS_IDLE_MS || 600000);`],

[`const MOBILE_HLS_MAX_SESSIONS = Number(process.env.MOBILE_HLS_MAX_SESSIONS || 2);`,
`const MOBILE_HLS_MAX_SESSIONS = Number(process.env.MOBILE_HLS_MAX_SESSIONS || 4);`],

[`const MEDIA_FFMPEG_STREAM_MAX = Number(process.env.MEDIA_FFMPEG_STREAM_MAX || 2);`,
`const MEDIA_FFMPEG_STREAM_MAX = Number(process.env.MEDIA_FFMPEG_STREAM_MAX || 3);`],

[`function playbackUrlHasUnsupportedVideoHint(srcUrl) {
  return /(x265|h265|hevc|10bit|10-bit|av1|vp9|vp8)/i.test(String(srcUrl || ''));
}`,
`function playbackUrlHasUnsupportedVideoHint(srcUrl) {
  return /(x265|h265|hevc|10bit|10-bit|av1|vp9|vp8)/i.test(String(srcUrl || ''));
}

function preferredRemotePlaybackMode(srcUrl) {
  if (playbackUrlHasUnsupportedVideoHint(srcUrl)) return 'hls';
  if (isRemoteDirectPlayable(srcUrl)) return 'proxy';
  const ext = path.extname(String(srcUrl || '').split('?')[0]).toLowerCase();
  if (['.mkv','.mov','.avi','.webm'].includes(ext)) return 'remux';
  return 'proxy';
}

function preferredLocalPlaybackMode(label, directPlayable) {
  if (playbackUrlHasUnsupportedVideoHint(label)) return 'hls';
  if (directPlayable) return 'direct';
  const ext = path.extname(String(label || '').split('?')[0]).toLowerCase();
  if (['.mkv','.mov','.avi','.webm'].includes(ext)) return 'remux';
  return 'direct';
}`],

[`const requestedMode = req.query.forceHls === '1' ? 'hls' : normalizePlaybackMode(req.query.mode, 'direct');
  const mode = requestedMode === 'direct' ? 'redirect' : requestedMode;`,
`const explicitMode = typeof req.query.mode === 'string' && req.query.mode.trim() !== '';
  const autoMode = preferredRemotePlaybackMode(srcUrl);
  const requestedMode = req.query.forceHls === '1' ? 'hls' : normalizePlaybackMode(req.query.mode, explicitMode ? 'direct' : autoMode);
  const mode = requestedMode === 'direct' ? (explicitMode ? 'redirect' : autoMode) : requestedMode;`],

[`function localPlaybackPlan(id, req, entry, filePath) {
  const requestedMode = req.query.forceHls === '1' ? 'hls' : normalizePlaybackMode(req.query.mode, 'direct');`,
`function localPlaybackPlan(id, req, entry, filePath) {
  const explicitMode = typeof req.query.mode === 'string' && req.query.mode.trim() !== '';
  const autoMode = preferredLocalPlaybackMode(entry.file || filePath, isRemoteDirectPlayable(filePath));
  const requestedMode = req.query.forceHls === '1' ? 'hls' : normalizePlaybackMode(req.query.mode, explicitMode ? 'direct' : autoMode);`],

[`function rewriteLiveRelayPlaylist(channelId, text) {
  return String(text || '').replace(/^(seg_[^\\r\\n]+\\.ts)$/gm, \`/live-relay/\${encodeURIComponent(channelId)}/$1?v=\${Date.now()}\`);
}`,
`function rewriteLiveRelayPlaylist(channelId, text) {
  const lines = String(text || '').split(/\\r?\\n/).map(x => x.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] || '';
    if (/^#EXTINF:/i.test(line)) {
      if (/^seg_.*\\.ts$/i.test(next)) {
        out.push(line);
        out.push(\`/live-relay/\${encodeURIComponent(channelId)}/\${next}?v=\${Date.now()}\`);
        i++;
      }
      continue;
    }
    if (/^seg_.*\\.ts$/i.test(line)) continue;
    out.push(line);
  }
  if (!out[0] || out[0] !== '#EXTM3U') out.unshift('#EXTM3U');
  return out.join('\\n') + '\\n';
}`],

[`app.get('/live-relay/:channelId/index.m3u8', async (req, res) => {`,
`app.get(['/live-relay/:channelId/index.m3u8', '/live-relay/:channelId/playlist.m3u8'], async (req, res) => {`]
]);

const appFile = fs.existsSync("public/app.js") ? "public/app.js" : "app.js";

patch(appFile, [
[`async function fetchLocalPlaybackPlan(id, start=0, options={}){
  const params = new URLSearchParams();`,
`function svPlaybackClientId(){
  try{
    let id = localStorage.getItem('sv_playback_client');
    if(!id){
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('sv_playback_client', id);
    }
    return id;
  }catch(_){
    return 'client-' + Math.random().toString(36).slice(2);
  }
}

async function fetchLocalPlaybackPlan(id, start=0, options={}){
  const params = new URLSearchParams();
  params.set('client', svPlaybackClientId());`],

[`params.set('plan','1');`,
`params.set('plan','1');
  params.set('client', svPlaybackClientId());`],

[`function fallbackOrderForRemote(url, plan={}){
  const unsupported = plan?.unsupportedVideoHint || urlHasUnsupportedVideoHint(url);
  const order = ['proxy'];
  if(!unsupported)order.push('remux','audio');
  order.push('hls');
  return order;
}`,
`function fallbackOrderForRemote(url, plan={}){
  const unsupported = plan?.unsupportedVideoHint || urlHasUnsupportedVideoHint(url);
  if(unsupported)return ['hls'];
  return ['proxy','remux','audio','hls'];
}`],

[`const seekTimer = setTimeout(()=>{`,
`const seekTimer = setTimeout(()=>{`],

[`}, 12000);`,
`}, 25000);`]
]);
